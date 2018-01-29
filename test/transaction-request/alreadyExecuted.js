require("chai")
	.use(require("chai-as-promised"))
	.should()

const expect = require("chai").expect

/// Contracts
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequest = artifacts.require("./TransactionRequest.sol")

/// Bring in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData, parseAbortData, wasAborted } = require("../dataHelpers.js")
const { wait, waitUntilBlock } = require("@digix/tempo")(web3)

contract("Test already executed", async function(accounts) {
	it("rejects execution if already executed", async function() {
		/// Deploy a fresh transactionRecorder
		const txRecorder = await TransactionRecorder.new()
		expect(
			txRecorder.address,
			"transactionRecorder should be fresh for each test"
		).to.exist

		const MINUTE = 60 //seconds
		const HOUR = 60 * MINUTE
		const DAY = 24 * HOUR

		const gasPrice = config.web3.utils.toWei("44", "gwei")
		const requiredDeposit = config.web3.utils.toWei("44", "kwei")

		const claimWindowSize = 5 * MINUTE
		const freezePeriod = 2 * MINUTE
		const reservedWindowSize = 1 * MINUTE
		const executionWindow = 2 * MINUTE

		const curBlock = await config.web3.eth.getBlock("latest")
		const timestamp = curBlock.timestamp

		const windowStart = timestamp + DAY

		/// Make a transactionRequest
		const txRequest = await TransactionRequest.new(
			[
				accounts[0], //createdBy
				accounts[0], //owner
				accounts[1], //donationBenefactor
				txRecorder.address, //toAddress
			],
			[
				0, //donation
				0, //payment
				claimWindowSize,
				freezePeriod,
				reservedWindowSize,
				2, // temporalUnit
				executionWindow,
				windowStart,
				2000000, //callGas
				0, //callValue
				gasPrice,
				requiredDeposit,
			],
			"some-call-data-goes-here",
			{ value: config.web3.utils.toWei("1") }
		)

		const requestData = await RequestData.from(txRequest)

		expect(await txRecorder.wasCalled()).to.be.false

		expect(requestData.meta.wasCalled).to.be.false

		/// Should claim a transaction before each test
		const secsToWait = requestData.schedule.windowStart - timestamp
		await waitUntilBlock(secsToWait, 0)

		const executeTx = await txRequest.execute({
			from: accounts[1],
			gas: 3000000,
			gasPrice: gasPrice,
		})
		expect(executeTx.receipt).to.exist

		const execute = executeTx.logs.find(e => e.event === "Executed")
		expect(execute, "should have fired off the execute log").to.exist

		await requestData.refresh()

		expect(await txRecorder.wasCalled()).to.be.true

		expect(requestData.meta.wasCalled).to.be.true

		/// Now try to duplicate the call
		const executeTx2 = await txRequest.execute({
			from: accounts[1],
			gas: 3000000,
			gasPrice: gasPrice,
		})

		expect(wasAborted(executeTx2)).to.be.true

		expect(
			parseAbortData(executeTx2).find(
				reason => reason === "AlreadyCalled"
			)
		).to.exist
	})
})
