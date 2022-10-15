// const snarkjs = require("snarkjs");

const Web3 = require('web3')
const web3 = new Web3(new Web3.providers.HttpProvider('http://localhost:8545'));
const assert = require('assert')
const eVote = artifacts.require("eVote.sol")
const verifierZKSNARK = artifacts.require("verifierZKSNARK")
const { MerkleTree } = require('../helper/merkletree.js')
const { genTestData } = require('../helper/voters.js')
const { tallying } = require('../helper/administrator.js')
const {mineToBlockNumber, takeSnapshot,revertToSnapshot} = require('../helper/truffleHelper.js')
const { getVerificationKeys } = require('../helper/verificationKeys.js');
const { fstat } = require('fs');
contract('eVote', async (accounts) => {
    let admin = accounts[0]
    log = 'Gas Cost\n'
    let eVoteInstance
    let verifierZKSNARKInstance;
    let data;
    let usersMerkleTree;
    let _tallyingResult;
    let _tallyingProof;
    let nVoters = __NVOTERS__
    let gasUsedRegister = []
    let gasUsedCast = []
    // Time the functions
    const t_begin = new Date().getTime()
    const date_start = new Date(t_begin)
    const datetime_JSON = date_start.toJSON()
    record_str = "{\"Datetime\": "+datetime_JSON +" , "
    record_str = record_str + "\"nVoters\" : " + nVoters.toString() + " , "

    it('Generate Testing Data', async ()=> {
        var t_begin = new Date().getTime()
        data = await genTestData(nVoters)
        let encryptedVotes = [];
        let expectedTallyingResult = 0;    
    for (i=0; i<data.length;i++){
        encryptedVotes.push(data[i].encryptedVote);
        expectedTallyingResult += data[i].Vote;
        }
        const { tallyingProof, tallyingResult } = await tallying(encryptedVotes)
        assert(expectedTallyingResult == tallyingResult, "Error: Tallying Result provided by the Tallying circuit is not equal to the expected Tallying result")
        _tallyingProof = tallyingProof
        _tallyingResult = tallyingResult

        usersMerkleTree = new MerkleTree(accounts.slice(1,accounts.length-1)) ;
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Generate Testing Data_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record
    }).timeout(90e6);
    
    it('Deploy the contracts', async ()=> {
        var t_begin = new Date().getTime();
        verifierZKSNARKInstance = await verifierZKSNARK.deployed();
        eVoteInstance = await eVote.deployed();
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Deploy the contracts_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    }).timeout(50000 * nVoters);

    it('Set Verification keys', async ()=> {
        var t_begin = new Date().getTime()
        let cost = 0;
        let cost_s = '';
        const verifierPublicKeyVkey = getVerificationKeys('../build/verifier_PublicKey.json')
        tx = await verifierZKSNARKInstance.setVerifyingKey(verifierPublicKeyVkey, 0);
        cost_s += tx.receipt.gasUsed.toString();
        cost += tx.receipt.gasUsed;
        var vPKVK_s = "verifierPublicKeyVkey_cost";
        var vPKVK_cost_s = tx.receipt.gasUsed.toString();
        var function_record = "\""+vPKVK_s+"\" : " + vPKVK_cost_s + " , ";
        
        const verifierEncrpytedVoteVkey = getVerificationKeys('../build/verifier_EncrpytedVote.json')
        tx = await verifierZKSNARKInstance.setVerifyingKey(verifierEncrpytedVoteVkey, 1);
        cost_s += ' + ' + tx.receipt.gasUsed.toString();
        cost += tx.receipt.gasUsed
        var vEVK_s = "verifierEncrpytedVoteVkey_cost";
        var vEVK_cost_s = tx.receipt.gasUsed.toString();
        function_record = function_record + "\"" + vEVK_s+"\" : " + vEVK_cost_s + " , ";

        const verifierTallyingVkey = getVerificationKeys('../build/verifier_tallying.json')
        tx = await verifierZKSNARKInstance.setVerifyingKey(verifierTallyingVkey, 2);
        cost_s += ' + ' + tx.receipt.gasUsed.toString();
        cost += tx.receipt.gasUsed
        cost_s += ' = ' + cost.toString();
        var vTVK_s = "verifierTallyingVkey_cost";
        var vTVK_cost_s = tx.receipt.gasUsed.toString();
        function_record = function_record + "\"" + vTVK_s+"\" : " + vTVK_cost_s + " , ";
        function_record = function_record + "\"Total SetVerificationkeys_cost\" : " + cost.toString() + " , ";

        log+=`SetVerificationkeys: ${cost_s.toString()}\n`  
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"SetVerificationkeys_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    }).timeout(5000 * nVoters);

    it('Register public keys for elligable users except the last one', async() => {
        let Rpkfeuetlo_cost = 0
        var t_begin = new Date().getTime()
        for(let i =0; i< data.length -1; i++) {
            _merkleProof = usersMerkleTree.getHexProof(accounts[i+1])                      
            tx = await eVoteInstance.register(data[i].publicKey, data[i].publicKeyProof.a, data[i].publicKeyProof.b, data[i].publicKeyProof.c, _merkleProof, {from:accounts[i+1], value:web3.utils.toWei("0.001","ether")})
            gasUsedRegister.push(tx.receipt.gasUsed.toString())
            Rpkfeuetlo_cost = Rpkfeuetlo_cost + tx.receipt.gasUsed
        }
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Register public keys for elligable users except the last one_cost\" : " + Rpkfeuetlo_cost.toString() + " , ";
        function_record = function_record + "\"Register public keys for elligable users except the last one_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    }).timeout(50000 * nVoters);

   it('Throw an error if non-elligable user tries to vote', async() =>{
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot()
        snapshotId = snapShot['result']
        _merkleProof = usersMerkleTree.getHexProof(accounts[accounts.length-2])            
        try{
            await eVoteInstance.register(data[0].publicKey, data[0].publicKeyProof.a, data[0].publicKeyProof.b, data[0].publicKeyProof.c, _merkleProof, {from:accounts[accounts.length-1], value:web3.utils.toWei("0.001","ether")})
        } catch(err) {
           assert(String(err).includes("Invalid Merkle proof"), "error in verifying invalid user")
        }
        await revertToSnapshot(snapshotId) 
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Throw an error if non-elligable user tries to vote_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    })

    it('Throw an error if elligable user provides invalid DL proof to vote', async() =>{
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot()
        snapshotId = snapShot['result']
        _merkleProof = usersMerkleTree.getHexProof(accounts[1])        
        try{
            await eVoteInstance.register(data[0].publicKey, data[0].publicKeyProof.a, data[0].publicKeyProof.b, data[0].publicKeyProof.c, _merkleProof, {from:accounts[1], value:web3.utils.toWei("0.001","ether")})
        } catch(err) {
            assert(String(err).includes("Invalid DL proof"), "error in verifying invalid user")
        }
        await revertToSnapshot(snapshotId)
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Throw an error if elligable user provides invalid DL proof to vote_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    })

    it('Register public key of the last voter', async() => {
        var t_begin = new Date().getTime()
        i = data.length -1
        _merkleProof = usersMerkleTree.getHexProof(accounts[i+1])                      
        tx = await eVoteInstance.register(data[i].publicKey, data[i].publicKeyProof.a, data[i].publicKeyProof.b, data[i].publicKeyProof.c, _merkleProof, {from:accounts[i+1], value:web3.utils.toWei("0.001","ether")})
        gasUsedRegister.push(tx.receipt.gasUsed.toString())
        cost_s = tx.receipt.gasUsed.toString()
        log+=`Register: ${gasUsedRegister[0].toString()}\n`        

        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Register public key of the last voter_cost\" : " + cost_s + " , ";
        function_record = function_record + "\"Register public key of the last voter_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    }).timeout(50000 * nVoters);

    it('Throw an error if an user tries to register but Max number of voters is reached', async() =>{
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot()
        snapshotId = snapShot['result']
        _merkleProof = usersMerkleTree.getHexProof(accounts[accounts.length-2])            
        try{
            await eVoteInstance.register(data[0].publicKey, data[0].publicKeyProof.a, data[0].publicKeyProof.b, data[0].publicKeyProof.c, _merkleProof, {from:accounts[accounts.length-1], value:web3.utils.toWei("0.001","ether")})
        } catch(err) {
           assert(String(err).includes("Max number of voters is reached"), "error in verifying max number of voters")
        }
        await revertToSnapshot(snapshotId)
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Throw an error if an user tries to register but Max number of voters is reached_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
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
        var function_time = t_end-t_begin;
        var function_record = "\"Cast valid encrypted votes_cost\" : " + cost.toString() + " , ";
        function_record = function_record + "\"Cast valid encrypted votes_cost_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    }).timeout(100000 * nVoters);

    it('Throw an error if elligable user provides invalid encrypted vote', async() => {       
        var t_begin = new Date().getTime()
        try{
            await eVoteInstance.castVote(data[0].encryptedVote, data[1].Idx, data[1].encryptedVoteProof.a, data[1].encryptedVoteProof.b, data[1].encryptedVoteProof.c, {from:accounts[2]})
        } catch(err) {
            assert(String(err).includes("Invalid encrypted vote"), "error in verifying invalid encrypted")
        }
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Throw an error if elligable user provides invalid encrypted vote_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;   
    })

    it('Malicious Administrator', async() => {
        var t_begin = new Date().getTime()
        snapShot = await takeSnapshot();
        snapshotId = snapShot['result'];

        beginTally = (await eVoteInstance.finishVotingBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginTally)        
        try{
            await eVoteInstance.setTally(_tallyingResult + 1, _tallyingProof.a, _tallyingProof.b, _tallyingProof.c,{from:admin});
        } catch(err) {
            assert(String(err).includes("Invalid Tallying Result"), "error in verifying Malicious Administrator")
        }
        await revertToSnapshot(snapshotId)
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Malicious Administrator\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record; 
    })
    it('Honst Administrator', async() => {
        var t_begin = new Date().getTime()
        beginTally = (await eVoteInstance.finishVotingBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginTally)
        tx = await eVoteInstance.setTally(_tallyingResult, _tallyingProof.a, _tallyingProof.b, _tallyingProof.c,{from:admin});
        log+=`setTally: ${tx.receipt.gasUsed.toString()}\n`
        let cost_s = tx.receipt.gasUsed.toString()
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Honst Administrator_cost\" : " + cost_s + " , ";
        function_record = function_record + "\"Honst Administrator_time\" : " + function_time.toString() + " , ";
        record_str = record_str + function_record;
    }).timeout(100000 * nVoters);

    it('Refund deposits for all', async () => {
        var t_begin = new Date().getTime()
        beginRefund = (await eVoteInstance.finishTallyBlockNumber.call()).toNumber()
        await mineToBlockNumber(beginRefund)
        for(let i =0; i< accounts.length-1; i++) {
            try{
                tx = await eVoteInstance.refund({from:accounts[i]})
            } catch(err) {}
        }
        log+=`Refund: ${tx.receipt.gasUsed.toString()}\n`
        var cost_s = tx.receipt.gasUsed.toString()
        console.log(log)
        var t_end = new Date().getTime();
        var function_time = t_end-t_begin;
        var function_record = "\"Refund deposits for all_cost\" : " + cost_s + " , ";
        function_record = function_record + "\"Refund deposits for all_time\" : " + function_time.toString() ;
        record_str = record_str + function_record;
        record_str = record_str + " }\n"

        var fs = require("fs");
        fs.appendFileSync("../log/test_log.txt", record_str);
    }).timeout(50000 * nVoters);
    
})
