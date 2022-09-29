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

async function genPublicKeyAndProof(randomNum, vote){
    // single voter. To be exposed to UI
    // randomNum: a random for privateKey generation
    // vote: an integer between 0 and (OPTIONS - 1)
    const babyJub = await buildBabyjub();
    const p = babyJub.p;
    const F = babyJub.F;
    const BASE8 = babyJub.Base8;
    const q = babyJub.subOrder;
    const pm1d2 = babyJub.pm1d2;

    let pk = babyJub.mulPointEscalar(BASE8, randomNum);
    let privateKey = Scalar.gt(F.toObject(pk[0]), pm1d2) ? (Scalar.sub(q, randomNum)).toString() : randomNum.toString();

    var { proof, publicSignals } = await genPublicKey(privateKey);
    const publicKeyProof = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
          ],
        c: [proof.pi_c[0], proof.pi_c[1]]
    }

    let public = {
        "publicKey" : publicSignals,
        "publicKeyProof": publicKeyProof
    }
    let private = {
        "publicKey" : publicSignals,
        "publicKeyProof": publicKeyProof,
        "privateKey": privateKey,
        "Vote": vote,
    }

    return { private, public }
}

async function genPublicKeysAndProofs(count, numOpts) {
    let publics = [];
    let privates = [];
    for (i=0; i<count ;i++){
        let randomNum = Math.floor(Math.random()*10000)
        let randomVote = Math.floor((Math.random()*10)) % numOpts
        let {private, public} = await genPublicKeyAndProof(randomNum, randomVote)

        let publicWithEncryption = {
            ...public,
            "Idx": i,
            "encryptedVote": null,
            "encryptedVoteProof": null
        }
        publics.push(publicWithEncryption)
        privates.push({
            ...private,
            ...publicWithEncryption
        })
    }
    return {privates, publics}
}

async function genEncryptedVoteAndProof(votingKeys, private){
    // single voter. To be exposed to UI
    // votingKeys: computed by public information. Probably from the chain
    // private: information that is accessible by the voter. Include his public and private information

    const inputs = {
        "VotingKeysX": votingKeys.X,
        "VotingKeysY": votingKeys.Y,
        "Idx": private.Idx,
        "xi": private.privateKey,
        "vote": private.Vote
    }

    var {genWitnessTime, genProofTime, proof, publicSignals} = await genEncryptedVote(inputs)
    private.encryptedVote = [publicSignals[0], publicSignals[1]]
    const encryptedVoteProof = {
        a: [proof.pi_a[0], proof.pi_a[1]],
        b: [
            [proof.pi_b[0][1], proof.pi_b[0][0]],
            [proof.pi_b[1][1], proof.pi_b[1][0]],
        ],
        c: [proof.pi_c[0], proof.pi_c[1]]
    }
    private.encryptedVoteProof = encryptedVoteProof

    return {genWitnessTime, genProofTime, publicSignals}
}

async function genEncryptedVotesAndProofs(privates, publics){
    let votingKeys = {
        "X": [],
        "Y": []
    }
    for (i=0; i<publics.length; i++){
        votingKeys.X.push(publics[i].publicKey[0])
        votingKeys.Y.push(publics[i].publicKey[1])
    }
    let genWitnessTimeAll = 0;
    let genProofTimeAll = 0;

    for (i=0; i<publics.length; i++){
        var {genWitnessTime, genProofTime, publicSignals} = await genEncryptedVoteAndProof(votingKeys, privates[i])
        genWitnessTimeAll += genWitnessTime
        genProofTimeAll += genProofTime 
        publics[i].encryptedVote = [publicSignals[0], publicSignals[1]]  // not required, but it is public
        privates[i].encryptedVote = [publicSignals[0], publicSignals[1]]
        publics[i].encryptedVoteProof = privates[i].encryptedVoteProof  // not required, but it is public
    }
    console.log(`encryptedVoteGen_genWitnessTime = ${genWitnessTimeAll/publics.length} ms, encryptedVoteGen_genProofTime = ${genProofTimeAll/publics.length} ms`)
}

async function genTestData(length) {
    const NUM_OPTIONS = 2
    let {privates, publics} = await genPublicKeysAndProofs(length, NUM_OPTIONS);
    await genEncryptedVotesAndProofs(privates, publics);
    return privates;
}
module.exports = {
    genTestData
}
