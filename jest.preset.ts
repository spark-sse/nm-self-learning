const nxPreset = require("@nrwl/jest/preset");

module.exports = { ...nxPreset, setupFiles: ["dotenv/config"] };