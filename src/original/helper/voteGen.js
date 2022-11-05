const testVotesGen = (nVoters, family='independent', params=[0.5]) => {
  if(family === 'independent'){
    const threshold = params[0]
    return Array(nVoters).fill().map(
      () => Math.random() < threshold ? 0 : 1
    )
  } else if (family === 'sequential0'){  // 0s first, then 1s
    const proportion0 = params[0]
    const zeroCount = Math.round(nVoters * proportion0)
    const oneCount = nVoters - zeroCount
    return Array(zeroCount).fill(0).concat(
      Array(oneCount).fill(1)
    )
  } else if (family === 'sequential1'){  // 1s first, then 0s
    const proportion0 = params[0]
    const zeroCount = Math.round(nVoters * proportion0)
    const oneCount = nVoters - zeroCount
    return Array(oneCount).fill(1).concat(
      Array(zeroCount).fill(0)
    )
  } else if (family === 'permutation'){  // constant proportion of 0s and 1s, but varying order
    const proportion0 = params[0]
    const zeroCount = Math.round(nVoters * proportion0)
    const oneCount = nVoters - zeroCount
    let arr = Array(zeroCount).fill(0).concat(
      Array(oneCount).fill(1)
    )
    let outArr = []
    while(arr.length) {
      var index = Math.floor(Math.random() * arr.length)
      outArr.push(arr[index])
      arr.splice(index, 1)
    }
    return outArr
  }
}
module.exports = {
  testVotesGen
}