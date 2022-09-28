const { genTestData } = require('../helper/voters.js')
const { tallying } = require('../helper/administrator.js')

async function main() {
    let nVoters = 3
    let nOptions = 3
    let encodingSize = 4
    const data = await genTestData(nVoters, nOptions, encodingSize)
    let encryptedVotes = [];
    let expectedTallyingResult = 0;
    for (i = 0; i < data.length; i++) {
        encryptedVotes.push(data[i].encryptedVote);
        expectedTallyingResult += data[i].Vote;
    }
    const { tallyingProof, tallyingResult } = await tallying(encryptedVotes)
    console.log(tallyingProof)
    console.log(tallyingResult)
}

main();
