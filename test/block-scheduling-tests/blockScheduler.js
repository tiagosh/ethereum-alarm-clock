require("chai")
	.use(require("chai-as-promised"))
	.should()

const expect = require("chai").expect

/// Contracts
const BlockScheduler = artifacts.require("./BlockScheduler.sol")
const PaymentLib = artifacts.require("./PaymentLib.sol")
const RequestFactory = artifacts.require("./RequestFactory.sol")
const RequestTracker = artifacts.require("./RequestTracker.sol")
const TransactionRecorder = artifacts.require("./TransactionRecorder.sol")
const TransactionRequest = artifacts.require("./TransactionRequest.sol")

/// Brings in config.web3 (v1.0.0)
const config = require("../../config")
const { RequestData, computeEndowment } = require("../dataHelpers.js")

const ethUtil = require("ethereumjs-util")

contract("Block scheduling", function(accounts) {
	const Owner = accounts[0]
	const User1 = accounts[1]
	const User2 = accounts[2]
	const gasPrice = 20000

	const donation = 0
	const payment = 0
	const requiredDeposit = config.web3.utils.toWei("22", "kwei")

	let blockScheduler
	let paymentLib
	let requestFactory
	let requestTracker
	let transactionRecorder

	const checkIsNotEmptyAddress = address => {
		return address == "0x0000000000000000000000000000000000000000"
	}

	/////////////
	/// Tests ///
	/////////////

	before(async () => {
		transactionRecorder = await TransactionRecorder.deployed()
		expect(transactionRecorder.address).to.exist

		requestTracker = await RequestTracker.deployed()
		expect(requestTracker.address).to.exist

		requestFactory = await RequestFactory.new(requestTracker.address)
		blockScheduler = await BlockScheduler.new(requestFactory.address)

		/// Get the factory address
		const factoryAddress = await blockScheduler.factoryAddress()
		expect(factoryAddress).to.equal(requestFactory.address)

		paymentLib = await PaymentLib.deployed()
		expect(paymentLib.address).to.exist
	})

	it("blockScheduler should arbitrarily accept payments sent to it", async function() {
		const balBefore = await config.web3.eth.getBalance(
			blockScheduler.address
		)
		const tx = await blockScheduler.sendTransaction({
			from: Owner,
			value: 1000,
		})

		const balAfter = await config.web3.eth.getBalance(
			blockScheduler.address
		)
		assert(balBefore < balAfter, "It sent 1000 wei correctly.")
	})

	it("should do block scheduling with `schedule`", async function() {
		const curBlockNum = await config.web3.eth.getBlockNumber()
		const windowStart = curBlockNum + 20
		const testData32 = ethUtil.bufferToHex(
			Buffer.from("A1B2".padEnd(32, "FF"))
		)

		// Endowment is the minimum amount of ether that must be sent for the transaction
		// to be scheduled. It covers all possible payments.
		const endowment = await paymentLib.computeEndowment(
			0,
			0,
			1212121, //callGas
			123454321, //callValue
			gasPrice,
			180000 //gas overhead
		)

		/// Now let's send it an actual transaction
		const scheduleTx = await blockScheduler.schedule(
			transactionRecorder.address,
			testData32, //callData
			[
				1212121, //callGas
				123454321, //callValue
				54321, //windowSize
				windowStart,
				gasPrice,
				donation,
				payment,
				requiredDeposit,
			],
			{
				from: accounts[0],
				value: endowment,
			}
		)

		expect(scheduleTx.receipt).to.exist

		expect(scheduleTx.receipt.gasUsed).to.be.below(3000000)

		// Let's get the logs so we can find the transaction request address.
		const logNewRequest = scheduleTx.logs.find(
			e => e.event === "NewRequest"
		)

		expect(logNewRequest.args.request).to.exist

		const txRequest = await TransactionRequest.at(
			logNewRequest.args.request
		)
		const requestData = await RequestData.from(txRequest)

		// Test that the endowment was sent to the txRequest
		const balOfTxRequest = await config.web3.eth.getBalance(
			txRequest.address
		)
		expect(parseInt(balOfTxRequest)).to.equal(requestData.calcEndowment())

		// Sanity check
		expect(requestData.calcEndowment()).to.equal(
			computeEndowment(payment, donation, 1212121, 123454321, gasPrice)
		)

		// Sanity check
		expect(endowment.toNumber()).to.equal(requestData.calcEndowment())

		expect(requestData.txData.toAddress).to.equal(
			transactionRecorder.address
		)

		expect(await txRequest.callData()).to.equal(testData32)

		expect(requestData.schedule.windowSize).to.equal(54321)

		expect(requestData.txData.callGas).to.equal(1212121)

		expect(requestData.paymentData.donation).to.equal(donation)

		expect(requestData.paymentData.payment).to.equal(payment)

		expect(requestData.schedule.windowStart).to.equal(windowStart)

		expect(requestData.txData.gasPrice).to.equal(gasPrice)

		expect(requestData.claimData.requiredDeposit).to.equal(
			parseInt(requiredDeposit)
		)
	})

	// This test fails because the call gas is too high
	it("should revert on invalid transaction", async function() {
		const curBlockNum = await config.web3.eth.getBlockNumber()
		const windowStart = curBlockNum + 20

		await blockScheduler
			.schedule(
				transactionRecorder.address,
				"this-is-the-call-data",
				[
					4e20, //callGas is set way too high
					123454321, //callValue
					0, //windowSize
					windowStart,
					gasPrice,
					donation,
					payment,
					requiredDeposit,
				],
				{ from: User2, value: config.web3.utils.toWei("10") }
			)
			.should.be.rejectedWith(
				"VM Exception while processing transaction: revert"
			)
	})
})
