var fs = require('fs')
var { parse } = require('csv-parse')
const { spawnSync, spawn } = require('child_process')

const inputFile = './testCasesAll.csv'
const testCasesFp = '../test/testCases.json'
var setups = []

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

fs.createReadStream(inputFile)
  .pipe(parse({delimiter: ','}))
  .on('data', function(csvrow) {
    // read csv setting file
    const _nVoters = csvrow[1]
    const _nOptions = csvrow[2]
    let _setup = setups.find(s => s.nVoters === _nVoters && s.nOptions === _nOptions)
    if(!_setup){
      _setup = {
        nVoters: _nVoters,
        nOptions: _nOptions,
        cases: []
      }
      setups.push(_setup)
    }
    _setup.cases.push({
      family: csvrow[3],
      params: [Number(csvrow[4])],
      numRuns: Number(csvrow[0])
    })
  })
  .on('end', async function() {
    for(let setupNum = 0; setupNum < setups.length; setupNum++){
      const setup = setups[setupNum]
      console.log(
        '=================\n',
        `Setup Number: ${setupNum + 1}\n`,
        'Setting up\n',
        '=================\n'
      )

      spawnSync('./setup.sh', ['-n', setup.nVoters, '-o', setup.nOptions  ], {
        stdio: 'inherit',
        cwd: '../build'
      })

      for (let i = 0; i < setup.cases.length; i++) {
        for (let j = 0; j < setup.cases[i].numRuns; j++) {
          const setupSingleCase = {
            nVoters: setup.nVoters,
            nOptions: setup.nOptions,
            cases: [{
              family: setup.cases[i].family,
              params: setup.cases[i].params
            }]
          }
          console.log(
            '=================\n',
            `nVoters: ${setupSingleCase.nVoters}. nOptions: ${setupSingleCase.nOptions}. Case: ${JSON.stringify(setupSingleCase.cases[0])} .NumRun: ${j + 1}\n`,
            '=================\n'
          )

          fs.writeFileSync(testCasesFp, JSON.stringify(setupSingleCase, null, 2))
          
          const voterPlus2 = String(Number(setup.nVoters) + 2)
          const ganacheChild = spawn('ganache-cli', ['-l', '30e6', '-a', voterPlus2], {
            cwd: '../build'
          })
          
          await sleep(5000)
          
          spawnSync('truffle', ['test'], {
            stdio: 'inherit',
            cwd: '../test'
          })
          
          ganacheChild.kill()
          
          if(fs.existsSync(testCasesFp)){
            fs.unlinkSync(testCasesFp)
          }

          await sleep(1000)
        }
      }
    }
    console.log(
      '=================\n',
      `Finished batch run\n`,
      `Check result at ../log \n`,
      '=================\n'
    )
  });
