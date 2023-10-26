module.exports = {
	istanbulReporter: ['html'],
	istanbulFolder: './coverage',
	skipFiles: [
		'interfaces',
		'test',
		'FareItems.sol',
		'FareNFTLootBox.sol',
		'FareNFTLootBoxController.sol',
	],
}
