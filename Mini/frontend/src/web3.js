/* eslint-disable no-restricted-globals */
import Web3 from 'web3';

// Combined contract ABI
const CONTRACT_ABI = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "cid",
          "type": "string"
        }
      ],
      "name": "CIDStored",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "bool",
          "name": "isFraudulent",
          "type": "bool"
        }
      ],
      "name": "FraudStatusUpdated",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "username",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "time",
          "type": "string"
        }
      ],
      "name": "UserLoggedIn",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "username",
          "type": "string"
        }
      ],
      "name": "UserRegistered",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "owner",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        },
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "userCIDs",
      "outputs": [
        {
          "internalType": "string",
          "name": "",
          "type": "string"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "users",
      "outputs": [
        {
          "internalType": "bytes32",
          "name": "usernameHash",
          "type": "bytes32"
        },
        {
          "internalType": "bytes32",
          "name": "passwordHash",
          "type": "bytes32"
        },
        {
          "internalType": "bool",
          "name": "exists",
          "type": "bool"
        },
        {
          "internalType": "bool",
          "name": "isFraudulent",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "username",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "password",
          "type": "string"
        }
      ],
      "name": "register",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "username",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "password",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "time",
          "type": "string"
        }
      ],
      "name": "login",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "userAddress",
          "type": "address"
        },
        {
          "internalType": "bool",
          "name": "isFraud",
          "type": "bool"
        }
      ],
      "name": "updateFraudStatus",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "userAddress",
          "type": "address"
        }
      ],
      "name": "isUserFraudulent",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "cid",
          "type": "string"
        }
      ],
      "name": "storeCID",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "address",
          "name": "user",
          "type": "address"
        }
      ],
      "name": "getCIDs",
      "outputs": [
        {
          "internalType": "string[]",
          "name": "",
          "type": "string[]"
        }
      ],
      "stateMutability": "view",
      "type": "function",
      "constant": true
    }
  ];

// UPDATE THIS WITH YOUR CONTRACT ADDRESS
const CONTRACT_ADDRESS = '0xC084Ea9a4eC52D7f8F87af1503ADB13E2b4b11d6'; // Updated to match the first file

const initWeb3 = async () => {
  try {
    let web3;
    let account;

    // Check if MetaMask is available
    if (typeof window !== 'undefined' && typeof window.ethereum !== 'undefined') {
      web3 = new Web3(window.ethereum);
      
      try {
        // Request account access if needed
        const accounts = await web3.eth.getAccounts();
        if (accounts.length === 0) {
          await window.ethereum.request({ method: 'eth_requestAccounts' });
          const newAccounts = await web3.eth.getAccounts();
          account = newAccounts[0];
        } else {
          account = accounts[0];
        }
      } catch (error) {
        console.error("MetaMask connection error:", error);
        throw new Error("Failed to connect to MetaMask");
      }
    } else {
      // Fallback to Ganache
      web3 = new Web3('http://127.0.0.1:7545');
      console.log("Connected to Ganache");
      
      const accounts = await web3.eth.getAccounts();
      account = accounts[0];
    }

    // Get network information
    const networkId = await web3.eth.net.getId();
    console.log('Current network ID:', networkId);
    
    // Check if we're on a development network (Ganache)
    if (networkId !== 1337 && networkId !== 5777) {
      console.warn('⚠️ Not connected to Ganache. Please switch to the correct network.');
    }

    // Create contract instance
    const contract = new web3.eth.Contract(CONTRACT_ABI, CONTRACT_ADDRESS);
    
    // Verify contract deployment
    const code = await web3.eth.getCode(CONTRACT_ADDRESS);
    if (code === '0x') {
      throw new Error(`No contract found at address ${CONTRACT_ADDRESS}`);
    }
    
    // Test contract by calling a read-only function
    try {
      const owner = await contract.methods.owner().call();
      console.log('✅ Contract connected successfully');
      console.log('Contract Owner:', owner);
    } catch (error) {
      console.error('❌ Contract connection test failed:', error);
      throw new Error('Contract ABI mismatch or contract not deployed properly');
    }
    
    console.log('✅ Web3 initialized successfully');
    console.log('Account:', account);
    console.log('Contract Address:', CONTRACT_ADDRESS);
    console.log('Network ID:', networkId);
    
    return { web3, account, contract };

  } catch (error) {
    console.error('Failed to initialize Web3:', error);
    throw error;
  }
};

export default initWeb3;