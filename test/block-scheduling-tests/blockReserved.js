require("chai")
	.use(require("chai-as-promised"))
	.should()

const expect = require("chai").expect

/// Contracts
const TransactionRequest = artifacts.require("./TransactionRequest.sol")
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")

/// Brings in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData, parseAbortData, wasAborted } = require("../dataHelpers.js")
const { wait, waitUntilBlock } = require("@digix/tempo")(web3)

contract("Block reserved window", function(accounts) {
	/// 1
	it("should reject execution if claimed by another", async function() {
		const txRecorder = await TransactionRecorder.new()
		expect(txRecorder.address).to.exist

		const curBlock = await config.web3.eth.getBlockNumber()
		const windowStart = curBlock + 38
		const executionWindow = 10

		const gasPrice = config.web3.utils.toWei("12", "gwei")
		const requiredDeposit = config.web3.utils.toWei("66", "kwei")

		const txRequest = await TransactionRequest.new(
			[
				accounts[0], //created by
				accounts[0], //owner
				accounts[1], //donation benefactor
				txRecorder.address, // to
			],
			[
				0, //donation
				0, //payment
				25, //claim window size
				5, //freeze period
				10, //reserved window size
				1, // temporal unit... 1= block, 2=timestamp
				executionWindow,
				windowStart,
				120000, //callGas
				0, //callValue
				gasPrice,
				requiredDeposit,
			],
			"this-is-the-call-data"
		)

		const requestData = await RequestData.from(txRequest)

		const claimAt =
			requestData.schedule.windowStart -
			requestData.schedule.freezePeriod -
			10
		await waitUntilBlock(0, claimAt)

		const claimTx = await txRequest.claim({
			from: accounts[7],
			value: config.web3.utils.toWei("2"),
		})
		expect(claimTx.receipt).to.exist

		await requestData.refresh()

		expect(requestData.claimData.claimedBy).to.equal(accounts[7])

		await waitUntilBlock(0, requestData.schedule.windowStart)

		expect(await txRecorder.wasCalled()).to.be.false

		expect(requestData.meta.wasCalled).to.be.false

		const executeTx = await txRequest.execute({ gas: 3000000 })

		await requestData.refresh()

		expect(await txRecorder.wasCalled()).to.be.false

		expect(requestData.meta.wasCalled).to.be.false

		expect(wasAborted(executeTx)).to.be.true

		expect(
			parseAbortData(executeTx).find(
				reason => reason === "ReservedForClaimer"
			)
		).to.exist
	})
})
