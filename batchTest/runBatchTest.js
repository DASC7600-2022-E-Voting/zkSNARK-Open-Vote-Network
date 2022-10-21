var fs = require('fs')
var { parse } = require('csv-parse')
const { spawnSync, spawn } = require("child_process")

const inputFile = './testCasesAll.csv'
var setups = []
fs.createReadStream(inputFile)
  .pipe(parse({delimiter: ','}))
  .on('data', function(csvrow) {
    // read csv setting file
    const _nVoters = csvrow[1]
    let _setup = setups.find(s => s.nVoters === _nVoters)
    if(!_setup){
      _setup = {
        nVoters: _nVoters,
        cases: []
      }
      setups.push(_setup)
    }
    _setup.cases.push({
      family: csvrow[2],
      params: [Number(csvrow[3])],
      numRuns: Number(csvrow[0])
    })
  })
  .on('end', async function() {
    setups.forEach((setup, setupNum) => {
      console.log(
        '=================\n',
        `Setup Number: ${setupNum + 1}\n`,
        'Setting up\n',
        '=================\n'
      )

      spawnSync('./setup.sh', ['-n', setup.nVoters], {
        stdio: 'inherit',
        cwd: '../build'
      })

      console.log(
        '=================\n',
        `Setup Number: ${setupNum + 1}\n`,
        'Start testing\n',
        '=================\n'
      )

      fs.writeFileSync('../test/testCases.json', JSON.stringify(setup, null, 2))

      const voterPlus2 = String(Number(setup.nVoters) + 2)
      const ganacheChild = spawn('ganache-cli', ['-l', '30e6', '-a', voterPlus2], {
        cwd: '../build'
      })

      spawnSync('truffle', ['test'], {
        stdio: 'inherit',
        cwd: '../test'
      })

      ganacheChild.kill()
      fs.unlinkSync('../test/testCases.json')
    })

    console.log(
      '=================\n',
      `Finished batch run\n`,
      `Check result at ../log \n`,
      '=================\n'
    )
  });
