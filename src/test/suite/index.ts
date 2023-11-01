import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';

export function run(): Promise<void> {

  // Create the mocha test
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    reporter: 'mocha-junit-reporter',
    reporterOptions: {
        mochaFile: 'artifacts/mocha_results.xml'
    }
  });

  const testsRoot = path.resolve(__dirname, '..');

  return new Promise((c, e) => {
    glob('**/**.test.js', { cwd: testsRoot }, (err, files) => {
      console.log("glob-1")
      if (err) {
        console.log("glob-2")
        return e(err);
      }

      // Add files to the test suite
      console.log("index-1")
      files.forEach(f => mocha.addFile(path.resolve(testsRoot, f)));
      console.log("index-2")

      try {
        console.log("index-3")
        // Run the mocha test
        mocha.run(failures => {
          console.log("index-4")
          if (failures > 0) {
            console.log("index-5")
            console.error(`${failures} tests failed.`)
            e(new Error(`${failures} tests failed.`));
            console.log("index-6")
          } else {
            console.log("index-7")
            c();
            console.log("index-8")
          }
          console.log("index-9")
        });
        console.log("index-10")
      } catch (err) {
        console.log("index-11")
        e(err);
        console.log("index-12")
      }
      console.log("index-13")
      return
    });
    console.log("index-14")
  });
}
