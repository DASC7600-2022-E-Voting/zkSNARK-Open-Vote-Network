// const snarkjs = require("snarkjs");

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const assert = require('assert')
const eVote = artifacts.require("eVote.sol")
const verifierZKSNARK = artifacts.require("verifierZKSNARK")
const { MerkleTree } = require('../helper/merkletree.js')
const { genTestData } = require('../helper/voters.js')
const { tallying } = require('../helper/administrator.js')
const {mineToBlockNumber, takeSnapshot,revertToSnapshot} = require('../helper/truffleHelper.js');
const { getVerificationKeys } = require('../helper/verificationKeys.js');
const fs = require('fs')

var testCases = {cases: [{family: 'independent', params: [0.5]}]}
if(fs.existsSync('./testCases.json')){
    testCases = require('./testCases.json')
}

for(let testCaseNum = 0; testCaseNum < testCases.cases.length; testCaseNum++){
    const testCase = testCases.cases[testCaseNum]
contract('eVote', async (accounts) => {
    let admin = accounts[0]
    let log = 'Gas Cost\n'
    let eVoteInstance
    let verifierZKSNARKInstance;
    let data;
    let usersMerkleTree;
    let _tallyingResult;
    let _tallyingProof;
    let nVoters = __NVOTERS__
    let family = testCase.family
    let params = testCase.params
    let gasUsedRegister = []
    let gasUsedCast = []

    // Record to json log
    var jsonRecord = {
        start_time: new Date(),
        n_voters: nVoters,
        vote_gen_family: family,
        params: params,
        steps: []
    }

    it('Generate Testing Data', async ()=> {
        var t_begin = new Date().getTime()
        data = await genTestData(nVoters, family, params)
        let encryptedVotes = [];
        let expectedTallyingResult = 0;    
        for (i=0; i<data.length;i++){
            encryptedVotes.push(data[i].encryptedVote);
            expectedTallyingResult += data[i].Vote;
        }
        const { tallyingProof, tallyingResult } = await tallying(encryptedVotes)

        const assertion = (expectedTallyingResult == tallyingResult)
        const errMsg = `Error: Tallying Result provided by the Tallying circuit is not equal to the expected Tallying result ${expectedTallyingResult} !== ${tallyingResult}`
        
        _tallyingProof = tallyingProof
        _tallyingResult = tallyingResult
        
        usersMerkleTree = new MerkleTree(accounts.slice(1,accounts.length-1)) ;
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Generate Testing Data",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? tallyingResult : errMsg,
        })
        assert(assertion, errMsg)
    }).timeout(90e6);
    
    it('Deploy the contracts', async ()=> {
        var t_begin = new Date().getTime();
        verifierZKSNARKInstance = await verifierZKSNARK.deployed();
        eVoteInstance = await eVote.deployed();

        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Deploy the contracts",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: true,
        })
    }).timeout(50000 * nVoters);

    it('Set Verification keys', async ()=> {
        var t_begin = new Date().getTime()
        let cost = 0;
        let cost_s = '';
        const verifierPublicKeyVkey = getVerificationKeys('../build/verifier_PublicKey.json')
        tx = await verifierZKSNARKInstance.setVerifyingKey(verifierPublicKeyVkey, 0);
        cost_s += tx.receipt.gasUsed.toString();
        cost += tx.receipt.gasUsed;

        var t1 = new Date().getTime()
        jsonRecord.steps.push({
            name: "Set Verification keys: PublicKey",
            start_time: t_begin,
            duration: t1 - t_begin,
            status_ok: true,
            cost: tx.receipt.gasUsed
        })
        
        const verifierEncrpytedVoteVkey = getVerificationKeys('../build/verifier_EncrpytedVote.json')
        tx = await verifierZKSNARKInstance.setVerifyingKey(verifierEncrpytedVoteVkey, 1);
        cost_s += ' + ' + tx.receipt.gasUsed.toString();
        cost += tx.receipt.gasUsed

        var t2 = new Date().getTime()
        jsonRecord.steps.push({
            name: "Set Verification keys: EncrpytedVote",
            start_time: t1,
            duration: t2 - t1,
            status_ok: true,
            cost: tx.receipt.gasUsed
        })

        const verifierTallyingVkey = getVerificationKeys('../build/verifier_tallying.json')
        tx = await verifierZKSNARKInstance.setVerifyingKey(verifierTallyingVkey, 2);
        cost_s += ' + ' + tx.receipt.gasUsed.toString();
        cost += tx.receipt.gasUsed
        cost_s += ' = ' + cost.toString();

        var t3 = new Date().getTime()
        jsonRecord.steps.push({
            name: "Set Verification keys: Tallying",
            start_time: t2,
            duration: t3 - t2,
            status_ok: true,
            cost: tx.receipt.gasUsed
        })

        log+=`SetVerificationkeys: ${cost_s.toString()}\n`  
    }).timeout(5000 * nVoters);

    it('Register public keys for elligible users except the last one', async() => {
        let Rpkfeuetlo_cost = 0
        var t_begin = new Date().getTime()
        for(let i =0; i< data.length -1; i++) {
            _merkleProof = usersMerkleTree.getHexProof(accounts[i+1])                      
            tx = await eVoteInstance.register(data[i].publicKey, data[i].publicKeyProof.a, data[i].publicKeyProof.b, data[i].publicKeyProof.c, _merkleProof, {from:accounts[i+1], value:web3.utils.toWei("0.001","ether")})
            gasUsedRegister.push(tx.receipt.gasUsed.toString())
            Rpkfeuetlo_cost = Rpkfeuetlo_cost + tx.receipt.gasUsed
        }

        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Register public keys for elligible users except the last one",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: true,
            cost: Rpkfeuetlo_cost
        })
    }).timeout(50000 * nVoters);

   it('Throw an error if non-elligable user tries to vote', async() =>{
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot()
        snapshotId = snapShot['result']
        _merkleProof = usersMerkleTree.getHexProof(accounts[accounts.length-2])            
        var caughtErrStr = ""
        try{
            await eVoteInstance.register(data[0].publicKey, data[0].publicKeyProof.a, data[0].publicKeyProof.b, data[0].publicKeyProof.c, _merkleProof, {from:accounts[accounts.length-1], value:web3.utils.toWei("0.001","ether")})
        } catch(err) {
            caughtErrStr = String(err)
        }
        const assertion = caughtErrStr.includes("Invalid Merkle proof")
        const errMsg = "error in verifying invalid user"
        await revertToSnapshot(snapshotId) 
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Throw an error if non-elligable user tries to vote",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? null : errMsg,
        })
        assert(assertion, errMsg)
    })

    it('Throw an error if sender already registered', async() =>{
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot()
        snapshotId = snapShot['result']
        _merkleProof = usersMerkleTree.getHexProof(accounts[1])
        var caughtErrStr = ""
        try{
            await eVoteInstance.register(data[0].publicKey, data[0].publicKeyProof.a, data[0].publicKeyProof.b, data[0].publicKeyProof.c, _merkleProof, {from:accounts[1], value:web3.utils.toWei("0.001","ether")})
        } catch(err) {
            caughtErrStr = String(err)
        }
        const assertion = caughtErrStr.includes("sender already registered")
        const errMsg = "error in rejecting already registered sender"
        await revertToSnapshot(snapshotId)
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Throw an error if sender already registered",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? null : errMsg,
        })
        assert(assertion, errMsg)
    })

    it('Register public key of the last voter', async() => {
        var t_begin = new Date().getTime()
        i = data.length -1
        _merkleProof = usersMerkleTree.getHexProof(accounts[i+1])                      
        tx = await eVoteInstance.register(data[i].publicKey, data[i].publicKeyProof.a, data[i].publicKeyProof.b, data[i].publicKeyProof.c, _merkleProof, {from:accounts[i+1], value:web3.utils.toWei("0.001","ether")})
        gasUsedRegister.push(tx.receipt.gasUsed.toString())

        log+=`Register: ${gasUsedRegister[0].toString()}\n`        

        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Register public key of the last voter",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: true,
            cost: tx.receipt.gasUsed
        })
    }).timeout(50000 * nVoters);

    it('Throw an error if an user tries to register but Max number of voters is reached', async() =>{
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot()
        snapshotId = snapShot['result']
        _merkleProof = usersMerkleTree.getHexProof(accounts[accounts.length-2])            
        var caughtErrStr = ""
        try{
            await eVoteInstance.register(data[0].publicKey, data[0].publicKeyProof.a, data[0].publicKeyProof.b, data[0].publicKeyProof.c, _merkleProof, {from:accounts[accounts.length-1], value:web3.utils.toWei("0.001","ether")})
        } catch(err) {
            caughtErrStr = String(err)
        }
        const assertion = caughtErrStr.includes("Max number of voters is reached")
        const errMsg = "error in verifying max number of voters"
        await revertToSnapshot(snapshotId)
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Throw an error if an user tries to register but Max number of voters is reached",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? null : errMsg,
        })
        assert(assertion, errMsg)
    })


    it('Cast valid encrypted votes', async() => {
        var t_begin = new Date().getTime()

        beginVote = (await eVoteInstance.finishRegistartionBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginVote)
        let cost = 0;
        // let gasused = [];
        for(let i=0; i<data.length; i++){
            tx = await eVoteInstance.castVote(data[i].encryptedVote, data[i].Idx, data[i].encryptedVoteProof.a, data[i].encryptedVoteProof.b, data[i].encryptedVoteProof.c, {from:accounts[i+1]})
            // if (i == 0){
            //     log+=`CastVote-1: ${tx.receipt.gasUsed.toString()}\n`        
            // }
            gasUsedCast.push(tx.receipt.gasUsed.toString())
            cost = cost + tx.receipt.gasUsed
        }
        log+=`CastVote: ${gasUsedCast[0].toString()}\n`

        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Cast valid encrypted votes",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: true,
            cost: cost
        })
    }).timeout(100000 * nVoters);

    it('Throw an error if elligable user provides invalid encrypted vote', async() => {       
        var t_begin = new Date().getTime()
        var caughtErrStr = ""
        try{
            await eVoteInstance.castVote(data[0].encryptedVote, data[1].Idx, data[1].encryptedVoteProof.a, data[1].encryptedVoteProof.b, data[1].encryptedVoteProof.c, {from:accounts[2]})
        } catch(err) {
            caughtErrStr = String(err)
        }
        const assertion = caughtErrStr.includes("Invalid encrypted vote")
        const errMsg = "error in verifying invalid encrypted"
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Throw an error if elligable user provides invalid encrypted vote",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? null : errMsg,
        })
        assert(assertion, errMsg)
    })

    it('Malicious Administrator', async() => {
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot();
        snapshotId = snapShot['result'];

        beginTally = (await eVoteInstance.finishVotingBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginTally)        
        var caughtErrStr = ""
        try{
            await eVoteInstance.setTally(_tallyingResult + 1, _tallyingProof.a, _tallyingProof.b, _tallyingProof.c,{from:admin});
        } catch(err) {
            caughtErrStr = String(err)
        }
        const assertion = caughtErrStr.includes("Invalid Tallying Result")
        const errMsg = "error in verifying Malicious Administrator"
        await revertToSnapshot(snapshotId)
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Malicious Administrator",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? null : errMsg,
        })
        assert(assertion, errMsg)
    })

    it('Honest Administrator', async() => {
        var t_begin = new Date().getTime()
        beginTally = (await eVoteInstance.finishVotingBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginTally)
        tx = await eVoteInstance.setTally(_tallyingResult, _tallyingProof.a, _tallyingProof.b, _tallyingProof.c,{from:admin});
        log+=`setTally: ${tx.receipt.gasUsed.toString()}\n`

        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Honest Administrator",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: true,
            cost: tx.receipt.gasUsed
        })
    }).timeout(100000 * nVoters);

    it('Refund deposits for all', async () => {
        var t_begin = new Date().getTime()
        var caughtErrStr = ""
        beginRefund = (await eVoteInstance.finishTallyBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginRefund)
        for(let i =0; i< accounts.length-1; i++) {
            try{
                tx = await eVoteInstance.refund({from:accounts[i]})
            } catch(err) {caughtErrStr += String(err) + '; '}
        }
        const assertion = (caughtErrStr == "")
        
        log+=`Refund: ${tx.receipt.gasUsed.toString()}\n`
        
        var t_end = new Date().getTime();
        jsonRecord.steps.push({
            name: "Refund deposits for all",
            start_time: t_begin,
            duration: t_end - t_begin,
            status_ok: assertion,
            message: assertion ? null : caughtErrStr,
            cost: tx.receipt.gasUsed
        })
        assert(assertion, caughtErrStr)
    }).timeout(50000 * nVoters);
    
    it('Saving logs', async () => {
        console.log(log)
        fs.appendFileSync("../log/test_log.jsonl", JSON.stringify(jsonRecord) + '\r\n');
    })
})
}