/// This test follows the full flow from the scheduling of a transaction to the execution thereof.
require("chai")
	.use(require("chai-as-promised"))
	.should()

const expect = require("chai").expect

/// Contracts
const BlockScheduler = artifacts.require("./BlockScheduler.sol")
const RequestFactory = artifacts.require("./RequestFactory.sol")
const RequestTracker = artifacts.require("./RequestTracker.sol")
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequest = artifacts.require("./TransactionRequest.sol")

const ethUtil = require("ethereumjs-util")

/// Brings in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData } = require("../dataHelpers.js")
const { waitUntilBlock } = require("@digix/tempo")(web3)

contract("Schedule to execution flow", function(accounts) {
	const gasPrice = config.web3.utils.toWei("33", "gwei")
	const testData = ethUtil.bufferToHex(
		Buffer.from("I am the test data".padEnd(32, "X123"))
	)

	let blockScheduler
	let requestFactory
	let requestTracker
	let txRecorder
	let txRequest

	let windowStart

	it("should instantiate the required contracts", async function() {
		txRecorder = await TransactionRecorder.new()
		expect(txRecorder.address).to.exist

		requestTracker = await RequestTracker.new()
		expect(requestTracker.address).to.exist

		requestFactory = await RequestFactory.new(requestTracker.address)
		expect(requestFactory.address).to.exist

		blockScheduler = await BlockScheduler.new(requestFactory.address)
		expect(blockScheduler.address).to.exist

		/// Sanity
		expect(await blockScheduler.factoryAddress()).to.equal(
			requestFactory.address
		)
	})

	it("should schedule a transaction", async function() {
		const curBlockNum = await config.web3.eth.getBlockNumber()
		windowStart = curBlockNum + 20

		const scheduleTx = await blockScheduler.schedule(
			txRecorder.address, //toAddress
			testData, //callData
			[
				1212121, //callGas
				123454321, //callValue
				365, //windowSize
				windowStart,
				gasPrice,
				98765, //donation
				80008, //payment
				config.web3.utils.toWei("20", "kwei"), // requiredDeposit
			],
			{ from: accounts[3], value: config.web3.utils.toWei("1") }
		)

		expect(scheduleTx.receipt).to.exist

		expect(scheduleTx.receipt.gasUsed).to.be.below(3000000)

		const NewRequest = scheduleTx.logs.find(e => e.event === "NewRequest")
		expect(NewRequest.args.request).to.exist

		txRequest = await TransactionRequest.at(NewRequest.args.request)
		expect(txRequest.address).to.exist
	})

	it("verifies the txRequest data", async function() {
		const requestData = await RequestData.from(txRequest)

		expect(requestData.txData.toAddress).to.equal(txRecorder.address)

		expect(await txRequest.callData()).to.equal(testData)

		expect(requestData.schedule.windowSize).to.equal(365)

		expect(requestData.txData.callGas).to.equal(1212121)

		expect(requestData.txData.callValue).to.equal(123454321)

		expect(requestData.schedule.windowStart).to.equal(windowStart)

		expect(requestData.txData.gasPrice).to.equal(parseInt(gasPrice))

		expect(requestData.paymentData.donation).to.equal(98765)

		expect(requestData.paymentData.payment).to.equal(80008)
	})

	it("should claim from an account", async function() {
		/// TODO
	})

	it("should execute the transaction with the correct gasPrice", async function() {
		const requestData = await RequestData.from(txRequest)

		expect(await txRecorder.wasCalled()).to.be.false

		expect(requestData.meta.wasCalled).to.be.false

		const startExecutionWindow = requestData.schedule.windowStart
		await waitUntilBlock(0, startExecutionWindow)

		const executeTx = await txRequest.execute({
			from: accounts[9],
			gas: 3000000,
			gasPrice: gasPrice,
		})

		expect(executeTx.receipt).to.exist

		await requestData.refresh()

		expect(await txRecorder.wasCalled()).to.be.true

		expect(requestData.meta.wasCalled).to.be.true
	})
})
