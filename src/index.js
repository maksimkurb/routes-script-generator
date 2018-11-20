'use strict';

const Assert = require('assert');

const Publisher = require('./publisher');
Assert(process.env.GATEWAY, 'Provide GATEWAY ip!');

let ifForce = false;
const args = process.argv.slice(2);
if (args.length) {
  Assert(args.length === 1);
  const a = args.shift();
  Assert(a === '--force');
  ifForce = true;
}

Publisher.updatePacScriptAsync(ifForce);
