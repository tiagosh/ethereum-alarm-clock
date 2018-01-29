require("chai")
	.use(require("chai-as-promised"))
	.should()

const expect = require("chai").expect

/// Contracts
const RequestFactory = artifacts.require("./RequestFactory.sol")
const RequestTracker = artifacts.require("./RequestTracker.sol")
const TimestampScheduler = artifacts.require("./TimestampScheduler.sol")
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequest = artifacts.require("./TransactionRequest.sol")

/// Brings in config.web3 (v1.0.0)
const config = require("../../config")
const { wait, waitUntilBlock } = require("@digix/tempo")(web3)
const { RequestData, computeEndowment } = require("../dataHelpers.js")

const ethUtil = require("ethereumjs-util")

contract("Timestamp scheduling", function(accounts) {
	const MINUTE = 60 //seconds

	const gasPrice = 20000
	const requiredDeposit = config.web3.utils.toWei("34", "kwei")
	const testData32 = ethUtil.bufferToHex(Buffer.from("32".padEnd(32, "AF01")))

	let requestFactory
	let requestTracker
	let timestampScheduler
	let transactionRecorder

	/// Deploy a fresh instance of contracts for each test.
	beforeEach(async function() {
		// Request tracker
		requestTracker = await RequestTracker.new()
		expect(requestTracker.address).to.exist

		// Request factory
		requestFactory = await RequestFactory.new(requestTracker.address)
		expect(requestFactory.address).to.exist

		// Timestamp scheduler
		timestampScheduler = await TimestampScheduler.new(
			requestFactory.address
		)
		expect(timestampScheduler.address).to.exist

		// Transaction recorder
		transactionRecorder = await TransactionRecorder.new()
		expect(transactionRecorder.address).to.exist
	})

	it("should do timestamp scheduling using `schedule", async function() {
		const curBlock = await config.web3.eth.getBlock("latest")
		const timestamp = curBlock.timestamp
		const windowStart = timestamp + 10 * MINUTE
		const donation = 98765
		const payment = 80008

		const scheduleTx = await timestampScheduler.schedule(
			transactionRecorder.address,
			testData32, //callData
			[
				1212121, //callGas
				123454321, //callValue
				55 * MINUTE, //windowSize
				windowStart,
				gasPrice,
				donation,
				payment,
				requiredDeposit,
			],
			{ from: accounts[0], value: config.web3.utils.toWei("10") }
		)

		expect(scheduleTx.receipt).to.exist

		expect(scheduleTx.receipt.gasUsed).to.be.below(3000000)

		// Dig the logs out for proof
		const logNewRequest = scheduleTx.logs.find(
			e => e.event === "NewRequest"
		)

		expect(logNewRequest.args.request).to.exist

		const txRequest = await TransactionRequest.at(
			logNewRequest.args.request
		)
		const requestData = await RequestData.from(txRequest)

		// Test that the endowment was sent to txRequest
		// const balOfTxRequest = await config.web3.eth.getBalance(txRequest.address)
		// expect(parseInt(balOfTxRequest))
		// .to.equal(requestData.calcEndowment())

		// Sanity check
		expect(requestData.calcEndowment()).to.equal(
			computeEndowment(payment, donation, 1212121, 123454321, gasPrice)
		)

		expect(requestData.txData.toAddress).to.equal(
			transactionRecorder.address
		)

		expect(await txRequest.callData()).to.equal(testData32)

		expect(requestData.schedule.windowSize).to.equal(55 * MINUTE)

		expect(requestData.txData.callGas).to.equal(1212121)

		expect(requestData.paymentData.donation).to.equal(donation)

		expect(requestData.paymentData.payment).to.equal(payment)

		expect(requestData.schedule.windowStart).to.equal(windowStart)

		expect(requestData.txData.gasPrice).to.equal(gasPrice)

		expect(requestData.claimData.requiredDeposit).to.equal(
			parseInt(requiredDeposit)
		)
	})

	it("should revert an invalid transaction", async function() {
		const curBlock = await config.web3.eth.getBlock("latest")
		const timestamp = curBlock.timestamp

		const windowStart = timestamp + 10 * MINUTE

		const scheduleTx = await timestampScheduler
			.schedule(
				accounts[4],
				testData32, //callData
				[
					4e20, //callGas is too high
					123123, //callValue
					55 * MINUTE, //windowSize
					windowStart,
					gasPrice,
					0, //donation
					0, //payment
					12, //requiredDeposit
				],
				{ from: accounts[0] }
			)
			.should.be.rejectedWith(
				"VM Exception while processing transaction: revert"
			)
	})
})
