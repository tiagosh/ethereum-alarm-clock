require("chai")
	.use(require("chai-as-promised"))
	.should()

const expect = require("chai").expect

const PaymentLib = artifacts.require("./PaymentLib.sol")

const BigNumber = require("bignumber.js")
const config = require("../../config")

/**
 * Tests the correct calculation of the endowment from PaymentLib.
 * The endowment is the value that must be sent with the scheduling transaction.
 * It covers the amount of ether for:
 *  - payment
 *  - donation
 *  - execution gas
 *  - callGas
 *  - callValue
 */

contract("PaymentLib", account => {
	const web3 = config.web3
	let paymentLib

	before(async () => {
		paymentLib = await PaymentLib.deployed()
	})

	it("returns the correct endowment [1/2]", async () => {
		const callGas = new BigNumber(3000000)
		const callValue = new BigNumber(123454321)
		const gasPrice = new BigNumber(web3.utils.toWei("55", "gwei"))
		const donation = new BigNumber(web3.utils.toWei("120", "finney"))
		const payment = new BigNumber(web3.utils.toWei("250", "finney"))

		const expectedEndowment = payment
			.plus(donation.mul(2))
			.plus(callGas.mul(gasPrice))
			.plus(gasPrice.mul(180000))
			.plus(callValue)

		const endowment = await paymentLib.computeEndowment(
			payment,
			donation,
			callGas,
			callValue,
			gasPrice,
			180000
		)

		expect(endowment.sub(expectedEndowment).toNumber()).to.equal(0)

		expect(expectedEndowment.toString()).to.equal(endowment.toString())
	})

	it("returns the correct endowment [2/2]", async () => {
		const callGas = new BigNumber(3333331)
		const callValue = new BigNumber(web3.utils.toWei("3", "ether"))
		const gasPrice = new BigNumber(web3.utils.toWei("25", "gwei"))
		const donation = new BigNumber(web3.utils.toWei("2", "ether"))
		const payment = new BigNumber(web3.utils.toWei("250", "finney"))

		const expectedEndowment = payment
			.plus(donation.mul(2))
			.plus(callGas.mul(gasPrice))
			.plus(gasPrice.mul(180000))
			.plus(callValue)

		const endowment = await paymentLib.computeEndowment(
			payment,
			donation,
			callGas,
			callValue,
			gasPrice,
			180000
		)

		expect(endowment.sub(expectedEndowment).toNumber()).to.equal(0)

		expect(expectedEndowment.toString()).to.equal(endowment.toString())
	})
})
