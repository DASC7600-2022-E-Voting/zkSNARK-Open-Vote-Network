function main() {
  const [numberOfVoter] = process.argv.slice(2);
  let N = Number(numberOfVoter);
  let encodingSize = 1;
  while (encodingSize < N) {
    encodingSize = encodingSize * 2;
  }
  console.log(encodingSize);
}

if (require.main === module) {
  main();
}
