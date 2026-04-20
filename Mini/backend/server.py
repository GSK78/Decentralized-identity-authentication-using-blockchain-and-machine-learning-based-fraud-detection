from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
from web3 import Web3
import os
from dotenv import load_dotenv
from sklearn.metrics import roc_curve, auc
import requests
import json

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:3000"}})

# Load environment variables
load_dotenv()
owner_address = os.getenv('OWNER_ADDRESS')
private_key = os.getenv('PRIVATE_KEY')
user_private_key = os.getenv('USER_PRIVATE_KEY')

if not owner_address or not private_key or not user_private_key:
    raise ValueError("OWNER_ADDRESS, PRIVATE_KEY, and USER_PRIVATE_KEY must be set in .env file")

# Blockchain setup
w3 = Web3(Web3.HTTPProvider('http://127.0.0.1:7545'))
if not w3.is_connected():
    raise ConnectionError("Failed to connect to Ethereum node")
print(f"Connected to blockchain. Latest block: {w3.eth.block_number}")

# Updated contract address for the combined contract
contract_address = '0xC084Ea9a4eC52D7f8F87af1503ADB13E2b4b11d6'  # Replace with your new combined contract address

# Updated ABI for the combined UserAuth + IPFS contract
contract_abi = [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": False,
      "inputs": [
        {
          "indexed": True,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": False,
          "internalType": "string",
          "name": "cid",
          "type": "string"
        }
      ],
      "name": "CIDStored",
      "type": "event"
    },
    {
      "anonymous": False,
      "inputs": [
        {
          "indexed": True,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": False,
          "internalType": "bool",
          "name": "isFraudulent",
          "type": "bool"
        }
      ],
      "name": "FraudStatusUpdated",
      "type": "event"
    },
    {
      "anonymous": False,
      "inputs": [
        {
          "indexed": True,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": False,
          "internalType": "string",
          "name": "username",
          "type": "string"
        },
        {
          "indexed": False,
          "internalType": "string",
          "name": "time",
          "type": "string"
        }
      ],
      "name": "UserLoggedIn",
      "type": "event"
    },
    {
      "anonymous": False,
      "inputs": [
        {
          "indexed": True,
          "internalType": "address",
          "name": "user",
          "type": "address"
        },
        {
          "indexed": False,
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
      "constant": True
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
      "constant": True
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
      "constant": True
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
      "constant": True
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
      "constant": True
    }
  ]

contract = w3.eth.contract(address=contract_address, abi=contract_abi)

# Verify contract deployment and owner
code = w3.eth.get_code(contract_address)
if code == b'':
    raise ValueError(f"No contract found at {contract_address}. Redeploy the contract.")
print(f"Contract code at {contract_address}: {code.hex()}")

contract_owner = contract.functions.owner().call()
if contract_owner.lower() != owner_address.lower():
    raise ValueError(f"Owner mismatch: .env owner {owner_address}, contract owner {contract_owner}")

# Load ML model and test data
model_path = r"C:\do\fraud-detection-dapp\savedresult\fraud_detection_model.pkl"
x_test_path = r"C:\do\fraud-detection-dapp\savedresult\X_test.pkl"
y_test_path = r"C:\do\fraud-detection-dapp\savedresult\y_test.pkl"

if not os.path.exists(model_path):
    raise FileNotFoundError(f"Model file not found: {model_path}")
if not os.path.exists(x_test_path):
    raise FileNotFoundError(f"X_test file not found: {x_test_path}")
if not os.path.exists(y_test_path):
    raise FileNotFoundError(f"y_test file not found: {y_test_path}")

model = joblib.load(model_path)
X_test = joblib.load(x_test_path)
y_test = joblib.load(y_test_path)

def update_fraud_status(user_address, is_fraud):
    try:
        user_balance = w3.eth.get_balance(user_address)
        print(f"User {user_address} balance: {w3.from_wei(user_balance, 'ether')} ETH")
        
        user = contract.functions.users(user_address).call()
        print(f"User {user_address} exists: {user[2]}, isFraud: {user[3]}")
        if not user[2]:
            print(f"User {user_address} not registered. Registering now...")
            if user_balance < w3.to_wei(0.01, 'ether'):
                print(f"Insufficient funds in {user_address} for registration")
                return None
            tx = contract.functions.register("testuser", "testpass").build_transaction({
                'from': user_address,
                'nonce': w3.eth.get_transaction_count(user_address),
                'gas': 3000000,
                'gasPrice': w3.to_wei('20', 'gwei')
            })
            signed_tx = w3.eth.account.sign_transaction(tx, user_private_key)
            tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
            receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
            print(f"User {user_address} registered. Tx Hash: {tx_hash.hex()}")
            if receipt['status'] == 0:
                print("Registration transaction reverted")
                return None

        tx = contract.functions.updateFraudStatus(user_address, is_fraud).build_transaction({
            'from': owner_address,
            'nonce': w3.eth.get_transaction_count(owner_address),
            'gas': 500000,
            'gasPrice': w3.to_wei('20', 'gwei')
        })
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        if receipt['status'] == 0:
            print("Fraud status update reverted")
            return None
        print(f"Fraud status updated for {user_address}. Tx Hash: {tx_hash.hex()}")
        return tx_hash.hex()
    except Exception as e:
        print(f"Error updating fraud status for {user_address}: {str(e)}")
        return str(e)

@app.route('/')
def home():
    return jsonify({
        "message": "Welcome to the Fraud Detection DApp API with IPFS Support",
        "endpoints": {
            "/check-fraud": "POST - Check if a transaction is fraudulent",
            "/roc-data": "GET - Retrieve ROC curve data",
            "/ipfs/store-cid": "POST - Store a CID on blockchain",
            "/ipfs/get-cids": "GET - Get all CIDs for a user",
            "/ipfs/validate-cid": "GET - Validate if a CID exists on IPFS",
            "/ipfs/get-file-info": "GET - Get file information from IPFS"
        }
    }), 200

@app.route('/check-fraud', methods=['POST'])
def check_fraud():
    try:
        data = request.json
        print("Received transaction data:", data)
        transaction = pd.DataFrame([data['transaction']])
        user_address = data['userAddress']
        expected_features = ['Time','V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 
                             'V11', 'V12', 'V13', 'V14', 'V15', 'V16', 'V17', 'V18', 'V19', 
                             'V20', 'V21', 'V22', 'V23', 'V24', 'V25', 'V26', 'V27', 'V28', 'Amount']
        if not all(feature in transaction.columns for feature in expected_features):
            return jsonify({'error': 'Invalid transaction data. Missing required features.'}), 400
        is_fraud = model.predict(transaction)[0]
        if is_fraud:
            tx_hash = update_fraud_status(user_address, True)
            if tx_hash and not isinstance(tx_hash, str):
                return jsonify({'isFraud': True, 'txHash': tx_hash}), 200
            return jsonify({'error': tx_hash}), 500
        return jsonify({'isFraud': False}), 200
    except Exception as e:
        print("Error in /check-fraud:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/roc-data', methods=['GET'])
def get_roc_data():
    try:
        y_scores = model.predict_proba(X_test)[:, 1]
        fpr, tpr, thresholds = roc_curve(y_test, y_scores)
        roc_auc = auc(fpr, tpr)
        return jsonify({'fpr': fpr.tolist(), 'tpr': tpr.tolist(), 'roc_auc': roc_auc}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# New IPFS-related endpoints

@app.route('/ipfs/store-cid', methods=['POST'])
def store_cid():
    """Store a CID on the blockchain"""
    try:
        data = request.json
        user_address = data.get('userAddress')
        cid = data.get('cid')
        
        if not user_address or not cid:
            return jsonify({'error': 'userAddress and cid are required'}), 400
        
        # Verify user exists
        user = contract.functions.users(user_address).call()
        if not user[2]:  # user.exists
            return jsonify({'error': 'User not registered'}), 400
        
        # Store CID on blockchain (this would typically be called from the frontend)
        print(f"CID storage request: User {user_address}, CID: {cid}")
        return jsonify({'message': 'CID store request received', 'cid': cid}), 200
        
    except Exception as e:
        print("Error in /ipfs/store-cid:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/ipfs/get-cids', methods=['GET'])
def get_user_cids():
    """Get all CIDs for a user from the blockchain"""
    try:
        user_address = request.args.get('userAddress')
        
        if not user_address:
            return jsonify({'error': 'userAddress parameter is required'}), 400
        
        # Get CIDs from blockchain
        cids = contract.functions.getCIDs(user_address).call()
        print(f"Retrieved CIDs for {user_address}: {cids}")
        
        return jsonify({
            'userAddress': user_address,
            'cids': cids,
            'count': len(cids)
        }), 200
        
    except Exception as e:
        print("Error in /ipfs/get-cids:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/ipfs/validate-cid', methods=['GET'])
def validate_cid():
    """Validate if a CID exists and is accessible on IPFS"""
    try:
        cid = request.args.get('cid')
        
        if not cid:
            return jsonify({'error': 'cid parameter is required'}), 400
        
        # Try to access the CID via IPFS gateway
        ipfs_url = f"https://ipfs.io/ipfs/{cid}"
        
        try:
            # Make a HEAD request to check if the content exists
            response = requests.head(ipfs_url, timeout=10)
            exists = response.status_code == 200
            
            result = {
                'cid': cid,
                'exists': exists,
                'accessible': exists,
                'ipfs_url': ipfs_url
            }
            
            if exists:
                result['content_type'] = response.headers.get('Content-Type', 'unknown')
                result['content_length'] = response.headers.get('Content-Length', 'unknown')
            
            return jsonify(result), 200
            
        except requests.RequestException as e:
            return jsonify({
                'cid': cid,
                'exists': False,
                'accessible': False,
                'error': f'Failed to access IPFS: {str(e)}',
                'ipfs_url': ipfs_url
            }), 200
            
    except Exception as e:
        print("Error in /ipfs/validate-cid:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/ipfs/get-file-info', methods=['GET'])
def get_file_info():
    """Get file information from IPFS"""
    try:
        cid = request.args.get('cid')
        
        if not cid:
            return jsonify({'error': 'cid parameter is required'}), 400
        
        # Try to get file metadata from IPFS gateway
        ipfs_url = f"https://ipfs.io/ipfs/{cid}"
        
        try:
            response = requests.head(ipfs_url, timeout=10)
            
            if response.status_code == 200:
                file_info = {
                    'cid': cid,
                    'accessible': True,
                    'ipfs_url': ipfs_url,
                    'content_type': response.headers.get('Content-Type', 'unknown'),
                    'content_length': response.headers.get('Content-Length', 'unknown'),
                    'last_modified': response.headers.get('Last-Modified', 'unknown'),
                    'etag': response.headers.get('ETag', 'unknown')
                }
                
                # Try to determine file type from content-type
                content_type = response.headers.get('Content-Type', '')
                if 'image' in content_type:
                    file_info['file_type'] = 'image'
                elif 'video' in content_type:
                    file_info['file_type'] = 'video'
                elif 'audio' in content_type:
                    file_info['file_type'] = 'audio'
                elif 'text' in content_type or 'json' in content_type:
                    file_info['file_type'] = 'text'
                elif 'application' in content_type:
                    file_info['file_type'] = 'application'
                else:
                    file_info['file_type'] = 'unknown'
                
                return jsonify(file_info), 200
            else:
                return jsonify({
                    'cid': cid,
                    'accessible': False,
                    'error': f'HTTP {response.status_code}',
                    'ipfs_url': ipfs_url
                }), 404
                
        except requests.RequestException as e:
            return jsonify({
                'cid': cid,
                'accessible': False,
                'error': f'Failed to access IPFS: {str(e)}',
                'ipfs_url': ipfs_url
            }), 500
            
    except Exception as e:
        print("Error in /ipfs/get-file-info:", str(e))
        return jsonify({'error': str(e)}), 500

@app.route('/user/profile', methods=['GET'])
def get_user_profile():
    """Get user profile information including IPFS files"""
    try:
        user_address = request.args.get('userAddress')
        
        if not user_address:
            return jsonify({'error': 'userAddress parameter is required'}), 400
        
        # Get user information from blockchain
        user = contract.functions.users(user_address).call()
        
        if not user[2]:  # user.exists
            return jsonify({'error': 'User not registered'}), 404
        
        # Get user's CIDs
        cids = contract.functions.getCIDs(user_address).call()
        
        # Get fraud status
        is_fraudulent = contract.functions.isUserFraudulent(user_address).call()
        
        profile = {
            'userAddress': user_address,
            'exists': user[2],
            'isFraudulent': is_fraudulent,
            'totalFiles': len(cids),
            'cids': cids
        }
        
        return jsonify(profile), 200
        
    except Exception as e:
        print("Error in /user/profile:", str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("Starting Flask server with IPFS support...")
    print(f"Contract Address: {contract_address}")
    print(f"Owner Address: {owner_address}")
    app.run(port=5000, debug=True)