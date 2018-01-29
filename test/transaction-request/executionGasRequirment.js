require('chai')
    .use(require('chai-as-promised'))
    .should()

const expect = require('chai').expect 

/// Contracts
const RequestLib = artifacts.require('./RequestLib.sol')
const TransactionRecorder = artifacts.require('./TransactionRecorder.sol')
const TransactionRequest = artifacts.require('./TransactionRequest.sol')

/// Bring in config.web3 (v1.0.0)
const config = require('../../config')
const { RequestData, parseAbortData, wasAborted } = require('../dataHelpers.js')
const { wait, waitUntilBlock } = require('@digix/tempo')(web3)

contract('Tests execution gas requirements', async accounts => {

    const gasPrice = config.web3.utils.toWei('34', 'gwei')
    const requiredDeposit = config.web3.utils.toWei('34', 'kwei')

    let requestLib
    let txRecorder
    let txRequest

    /// TransactionRequest constants
    const claimWindowSize = 25//blocks
    const freezePeriod = 5//blocks
    const reservedWindowSize = 10//blocks
    const executionWindow = 10//blocks
    
    const donation = 232323
    const payment = 343434

    beforeEach(async () => {
        txRecorder = await TransactionRecorder.new()
        expect(txRecorder.address)
        .to.exist 

        requestLib = await RequestLib.deployed()

        const curBlockNum = await config.web3.eth.getBlockNumber()
        const windowStart = curBlockNum + 60

        txRequest = await TransactionRequest.new(
            [
                accounts[0],    //createdBy
                accounts[0],    //owner
                accounts[1],    //donationBenefactor
                txRecorder.address//toAddress
            ], [
                donation,
                payment,
                claimWindowSize,
                freezePeriod,
                reservedWindowSize,
                1,
                executionWindow,
                windowStart,
                2000000,
                config.web3.utils.toWei('122', 'finney'),
                gasPrice,
                requiredDeposit
            ],
            'here-I-am!!-the-call-data',
            {value: config.web3.utils.toWei('1', 'ether')}
        )
        expect(txRequest.address)
        .to.exist 
    })

    it('test direct execution rejected with insufficient gas', async () => {

        const requestData = await RequestData.from(txRequest)

        expect(await txRecorder.wasCalled())
        .to.be.false 

        await waitUntilBlock(0, requestData.schedule.windowStart)

        const minCallGas = requestData.txData.callGas + (await requestLib.executionGasOverhead()).toNumber()

        const tooLowCallGas = minCallGas - (await requestLib.preExecutionGas()).toNumber()    

        const executeTx = await txRequest.execute({
            gas: tooLowCallGas,
            gasPrice: gasPrice
        })
        expect(executeTx.receipt)
        .to.exist 

        expect(wasAborted(executeTx))
        .to.be.true 

        expect(parseAbortData(executeTx).find(reason => reason === 'InsufficientGas'))
        .to.exist

        expect(await txRecorder.wasCalled())
        .to.be.false
    })

    it('test direct execution accepted with minimum gas', async () => {

        const requestData = await RequestData.from(txRequest)

        expect(await txRecorder.wasCalled())
        .to.be.false 

        await waitUntilBlock(0, requestData.schedule.windowStart)

        const minCallGas = requestData.txData.callGas + (await requestLib.executionGasOverhead()).toNumber()

        const tooLowCallGas = minCallGas - (await requestLib.preExecutionGas()).toNumber()    

        const executeTx = await txRequest.execute({
            gas: minCallGas,
            gasPrice: gasPrice
        })
        expect(executeTx.receipt)
        .to.exist 

        expect(wasAborted(executeTx))
        .to.be.false 

        await requestData.refresh()

        expect(await txRecorder.wasCalled())
        .to.be.true 

        expect(requestData.meta.wasCalled)
        .to.be.true
    })
})