const { FullProve } = require('./snarkjsHelper')
const buildBabyjub = require("circomlibjs").buildBabyjub;
const { Scalar }  =  require("ffjavascript");

const PublicKeyGen_wasm = "../build/PublicKeyGen_js/PublicKeyGen.wasm";
const PublicKeyGen_zkey = "../build/PublicKeyGenFinal.zkey";
const PublicKeyGen_wtns_cal = '../build/PublicKeyGen_js/witness_calculator.js';

const encryptedVoteGen_wasm = "../build/encryptedVoteGen_js/encryptedVoteGen.wasm";
const encryptedVoteGen_zkey = "../build/encryptedVoteGenFinal.zkey";
const encryptedVoteGen_wtns_cal = '../build/encryptedVoteGen_js/witness_calculator.js';

 
async function genPublicKey(privateKey) {

    const { proof, publicSignals } = await FullProve(
        {"privateKey": privateKey},
        PublicKeyGen_wasm,
        PublicKeyGen_zkey,
        PublicKeyGen_wtns_cal
    );
    return { proof, publicSignals }
}

async function genEncryptedVote(inputs) {

    const {genWitnessTime, genProofTime, proof, publicSignals} = await FullProve(
        inputs,
        encryptedVoteGen_wasm,
        encryptedVoteGen_zkey,
        encryptedVoteGen_wtns_cal
    );
    return {genWitnessTime, genProofTime, proof, publicSignals}
}

async function genPublicKeyAndProof(random, vote){
    // single voter. To be exposed to UI
    const babyJub = await buildBabyjub();
    const p = babyJub.p;
    const F = babyJub.F;
    const BASE8 = babyJub.Base8;
    const q = babyJub.subOrder;
    const pm1d2 = babyJub.pm1d2;

    let pk = babyJub.mulPointEscalar(BASE8, random);
    let privateKey = Scalar.gt(F.toObject(pk[0]), pm1d2) ? (Scalar.sub(q, random)).toString() : random.toString();

    var { proof, publicSignals } = await genPublicKey(privateKey);
    const publicKeyProof = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
          ],
        c: [proof.pi_c[0], proof.pi_c[1]]
    }

    return {
        "privateKey": privateKey,
        "publicKey" : publicSignals,
        "Vote": vote,
        "publicKeyProof": publicKeyProof
    }
}

async function genPublicKeysAndProofs(count) {
    result = [];
    for (i=0; i<count ;i++){
        let vote = Math.floor((Math.random()*10)) % 2
        let res = await genPublicKeyAndProof(Math.floor(Math.random()*10000), vote)

        result.push({
            ...res,
            "Idx": i,
            "encryptedVote": null,
            "encryptedVoteProof": null
        })      
    }
    return result
}

async function genEncryptedVotesAndProofs(voters){
    let VotingKeysX = [];
    let VotingKeysY = [];
    for (i=0; i<voters.length; i++){
        VotingKeysX.push(voters[i].publicKey[0])
        VotingKeysY.push(voters[i].publicKey[1])
    }
    let genWitnessTimeAll = 0;
    let genProofTimeAll = 0;

    for (i=0; i<voters.length; i++){
        inputs = { "VotingKeysX": VotingKeysX,
            "VotingKeysY": VotingKeysY,
            "Idx": voters[i].Idx,
            "xi": voters[i].privateKey,
            "vote": voters[i].Vote
        }
        var {genWitnessTime, genProofTime, proof, publicSignals} = await genEncryptedVote(inputs)
        genWitnessTimeAll += genWitnessTime
        genProofTimeAll +=genProofTime 
        voters[i].encryptedVote = [publicSignals[0], publicSignals[1]]
        const encryptedVoteProof = {
            a: [proof.pi_a[0], proof.pi_a[1]],
            b: [
                [proof.pi_b[0][1], proof.pi_b[0][0]],
                [proof.pi_b[1][1], proof.pi_b[1][0]],
              ],
            c: [proof.pi_c[0], proof.pi_c[1]]
        } 
        voters[i].encryptedVoteProof = encryptedVoteProof
    }
    console.log(`encryptedVoteGen_genWitnessTime = ${genWitnessTimeAll/voters.length} ms, encryptedVoteGen_genProofTime = ${genProofTimeAll/voters.length} ms`)

}

async function genTestData(length) {
    const res = await genPublicKeysAndProofs(length);
    await genEncryptedVotesAndProofs(res);
    return res;
}
module.exports = {
    genTestData
}
