const { expect } = require("chai");
const keccak256 = require('keccak256');
const { MerkleRoot, default: MerkleTree } = require('merkletreejs');

function encodeLeaf(address, spots) {
  //same as abi.encodePacked in solidity
  return ethers.AbiCoder.defaultAbiCoder().encode(
    ["address", "uint64"], //The datatypes of arguments to encode
    [address, spots]//actual value
  )
}

describe("Merkle Trees", function() {
  it("Should be able to verify if address is in whitelist or not", async function() {
    //Get a bunch of test addresses
    const testAddresses = await ethers.getSigners();
    //create an array of ABI-encoded elements to put in the Merkle Tree
    const list = [
      encodeLeaf(testAddresses[0].address, 2),
      encodeLeaf(testAddresses[1].address, 2),
      encodeLeaf(testAddresses[2].address, 2),
      encodeLeaf(testAddresses[3].address, 2),
      encodeLeaf(testAddresses[4].address, 2),
      encodeLeaf(testAddresses[5].address, 2),
    ];
    // Using keccak256 as the hashing algorithm, create a Merkle Tree
    // We use keccak256 because Solidity supports it
    // We can use keccak256 directly in smart contracts for verification
    // Make sure to sort the tree so it can be reproduced deterministically each time
    const merkleTree = new MerkleTree(list, keccak256, {
      hashLeaves: true, //Hash each lead using keccak256 to make them fixed size
      sortPairs: true,//Sort the tree for deterministic output
      sortLeaves: true,
    });
    //Compute the MerkleTree Root in Hexadecimal
    const root = merkleTree.getHexRoot();
    //deploy the whitelist contract
    const whitelist = await ethers.getContractFactory("Whitelist");
    const Whitelist = await whitelist.deploy(root);
    await Whitelist.waitForDeployment();

    //check for valid addresses
    for (let i = 0; i < 6; i++) {
      //Compute the MerkleProof for 'testAddresses[i]'
      const leaf = keccak256(list[i]);//Hash of the node
      const proof = merkleTree.getHexRoot(leaf);//Get the Merkle Proof
      //connect the current addresses being tested to the whitelist contract
      //  // as the 'caller'. So the contract's `msg.sender` value is equal to the value being checked
      // This is done because our contract uses `msg.sender` as the 'original value' for
      // the address when verifying the Merkle Proof
      const connectedWhitelist = await Whitelist.connect(testAddresses[i]);
      // Verify that the contract can verify the presence of this address
      // in the Merkle Tree using just the Root provided to it
      // By giving it the Merkle Proof and the original values
      // It calculates `address` using `msg.sender`, and we provide it the number of NFTs
      // that the address can mint ourselves
      const verified = await connectedWhitelist.checkInWhitelist(proof, 2);
      expect(verified).to.equal(true);
    }
    //check for invalid addresses
    const verifiedInvalid = verifiedInWhitelist([], 2);
    expect(verifiedInvalid).to.equal(false);


  })
})
