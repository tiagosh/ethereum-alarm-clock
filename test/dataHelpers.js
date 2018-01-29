const wasAborted = executeTx => {
	const Aborted = executeTx.logs.find(e => e.event === "Aborted")
	return Aborted ? true : false
}

const parseAbortData = executeTx => {
	const reason = [
		"WasCancelled", //0
		"AlreadyCalled", //1
		"BeforeCallWindow", //2
		"AfterCallWindow", //3
		"ReservedForClaimer", //4
		"InsufficientGas", //5
		"MismatchGasPrice", //6
	]

	const abortedLogs = executeTx.logs.filter(e => e.event === "Aborted")
	let abortedNums = []
	abortedLogs.forEach(log => {
		abortedNums.push(log.args.reason.toNumber())
	})
	const reasons = abortedNums.map(num => {
		return reason[num]
	})

	return reasons
}

const computeEndowment = (payment, donation, callGas, callValue, gasPrice) => {
	return (
		payment +
		donation * 2 +
		callGas * gasPrice +
		180000 * gasPrice +
		callValue
	)
}

const parseRequestData = async transactionRequest => {
	const data = await transactionRequest.requestData()
	return {
		claimData: {
			claimedBy: data[0][0],
			claimDeposit: data[2][0].toNumber(),
			paymentModifier: data[3][0].toNumber(),
			requiredDeposit: data[2][14].toNumber(),
		},

		meta: {
			createdBy: data[0][1],
			owner: data[0][2],
			isCancelled: data[1][0],
			wasCalled: data[1][1],
			wasSuccessful: data[1][2],
		},

		paymentData: {
			donationBenefactor: data[0][3],
			paymentBenefactor: data[0][4],
			donation: data[2][1].toNumber(),
			donationOwed: data[2][2].toNumber(),
			payment: data[2][3].toNumber(),
			paymentOwed: data[2][4].toNumber(),
		},

		schedule: {
			claimWindowSize: data[2][5].toNumber(),
			freezePeriod: data[2][6].toNumber(),
			reservedWindowSize: data[2][7].toNumber(),
			temporalUnit: data[2][8].toNumber(),
			windowSize: data[2][9].toNumber(),
			windowStart: data[2][10].toNumber(),
		},

		txData: {
			callGas: data[2][11].toNumber(),
			callValue: data[2][12].toNumber(),
			gasPrice: data[2][13].toNumber(),
			toAddress: data[0][5],
		},
	}
}

class RequestData {
	constructor(data, txRequest) {
		if (typeof data === undefined || typeof txRequest === undefined) {
			throw new Error("Can not call the constructor!")
		}

		this.txRequest = txRequest
		this.claimData = {
			claimedBy: data[0][0],
			claimDeposit: data[2][0].toNumber(),
			paymentModifier: data[3][0].toNumber(),
			requiredDeposit: data[2][14].toNumber(),
		}

		this.meta = {
			createdBy: data[0][1],
			owner: data[0][2],
			isCancelled: data[1][0],
			wasCalled: data[1][1],
			wasSuccessful: data[1][2],
		}

		this.paymentData = {
			donationBenefactor: data[0][3],
			paymentBenefactor: data[0][4],
			donation: data[2][1].toNumber(),
			donationOwed: data[2][2].toNumber(),
			payment: data[2][3].toNumber(),
			paymentOwed: data[2][4].toNumber(),
		}

		this.schedule = {
			claimWindowSize: data[2][5].toNumber(),
			freezePeriod: data[2][6].toNumber(),
			reservedWindowSize: data[2][7].toNumber(),
			temporalUnit: data[2][8].toNumber(),
			windowSize: data[2][9].toNumber(),
			windowStart: data[2][10].toNumber(),
		}

		this.txData = {
			callGas: data[2][11].toNumber(),
			callValue: data[2][12].toNumber(),
			gasPrice: data[2][13].toNumber(),
			toAddress: data[0][5],
		}
	}

	static async from(txRequest) {
		const data = await txRequest.requestData()
		return new RequestData(data, txRequest)
	}

	async refresh() {
		if (typeof this.txRequest === "undefined") {
			throw new Error("Must instantiate the RequestData first!")
		}
		const data = await this.txRequest.requestData()
		this.claimData = {
			claimedBy: data[0][0],
			claimDeposit: data[2][0].toNumber(),
			paymentModifier: data[3][0].toNumber(),
		}

		this.meta = {
			createdBy: data[0][1],
			owner: data[0][2],
			isCancelled: data[1][0],
			wasCalled: data[1][1],
			wasSuccessful: data[1][2],
		}

		this.paymentData = {
			donationBenefactor: data[0][3],
			paymentBenefactor: data[0][4],
			donation: data[2][1].toNumber(),
			donationOwed: data[2][2].toNumber(),
			payment: data[2][3].toNumber(),
			paymentOwed: data[2][4].toNumber(),
		}

		this.schedule = {
			claimWindowSize: data[2][5].toNumber(),
			freezePeriod: data[2][6].toNumber(),
			reservedWindowSize: data[2][7].toNumber(),
			temporalUnit: data[2][8].toNumber(),
			windowSize: data[2][9].toNumber(),
			windowStart: data[2][10].toNumber(),
		}

		this.txData = {
			callGas: data[2][11].toNumber(),
			callValue: data[2][12].toNumber(),
			gasPrice: data[2][13].toNumber(),
			toAddress: data[0][5],
		}
	}

	calcEndowment() {
		return (
			this.paymentData.payment +
			this.paymentData.donation * 2 +
			this.txData.callGas * this.txData.gasPrice +
			180000 * this.txData.gasPrice +
			this.txData.callValue
		)
	}
}

module.exports.computeEndowment = computeEndowment
module.exports.RequestData = RequestData
module.exports.parseRequestData = parseRequestData
module.exports.parseAbortData = parseAbortData
module.exports.wasAborted = wasAborted
