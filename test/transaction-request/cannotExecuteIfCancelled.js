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

contract("tests execution rejected if cancelled", async function(accounts) {
	it("will reject the execution if it was cancelled", async function() {
		const Owner = accounts[0]

		const gasPrice = config.web3.utils.toWei("66", "gwei")
		const requiredDeposit = config.web3.utils.toWei("66", "kwei")

		/// TransactionRequest constants
		const claimWindowSize = 25 //blocks
		const freezePeriod = 5 //blocks
		const reservedWindowSize = 10 //blocks
		const executionWindow = 10 //blocks

		const curBlockNum = await config.web3.eth.getBlockNumber()
		const windowStart = curBlockNum + 38

		const txRecorder = await TransactionRecorder.new()

		const txRequest = await TransactionRequest.new(
			[
				Owner, //createdBy
				Owner, //owner
				accounts[1], //donationBenefactor
				txRecorder.address, //toAddress
			],
			[
				0, //donation
				0, //payment
				claimWindowSize,
				freezePeriod,
				reservedWindowSize,
				1, //temporalUnit = 1, aka blocks
				executionWindow,
				windowStart,
				2000000, //callGas
				0, //callValue
				gasPrice,
				requiredDeposit,
			],
			"some-call-data-could-be-anything",
			{ value: config.web3.utils.toWei("1") }
		)
		const requestData = await RequestData.from(txRequest)

		expect(await txRecorder.wasCalled()).to.be.false

		expect(requestData.meta.wasCalled).to.be.false

		expect(requestData.meta.isCancelled).to.be.false

		const cancelTx = await txRequest.cancel({ from: Owner })
		expect(cancelTx.receipt).to.exist

		await requestData.refresh()

		expect(requestData.meta.isCancelled).to.be.true

		await waitUntilBlock(0, windowStart)

		const executeTx = await txRequest.execute({
			gas: 3000000,
			gasPrice: gasPrice,
		})

		await requestData.refresh()

		expect(await txRecorder.wasCalled()).to.be.false

		expect(requestData.meta.wasCalled).to.be.false

		expect(wasAborted(executeTx)).to.be.true

		expect(
			parseAbortData(executeTx).find(reason => reason === "WasCancelled")
		).to.exist
	})
})
