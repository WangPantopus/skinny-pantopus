// Loads the same backend env file the retained runtime uses (without overriding the explicit
// harness overrides already in process.env), then starts the backend from the checkout in argv.
const src = process.argv[2];
require(src + '/backend/node_modules/dotenv').config({ path: '/Users/yingpengwang/skinny-pantopus/backend/.env', quiet: true });
process.chdir(src + '/backend');
require(src + '/backend/app.js');
