/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import initWeb3 from "./web3.js";
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip, Legend, CategoryScale } from 'chart.js';
import { create } from 'ipfs-http-client';
import { Buffer } from 'buffer';
import './App.css';

// Register Chart.js components
ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, Legend, CategoryScale);

// Initialize IPFS client with local Kubo node
const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' });

function App() {
  const [web3, setWeb3] = useState(null);
  const [account, setAccount] = useState("");
  const [contract, setContract] = useState(null);
  const [ipfsContract, setIpfsContract] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isRegistered, setIsRegistered] = useState(null);
  const [isFraudulent, setIsFraudulent] = useState(null);
  const [rocData, setRocData] = useState({ fpr: [], tpr: [], roc_auc: 0 });
  const [fileCid, setFileCid] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState("login");
  const [userCIDs, setUserCIDs] = useState([]);
  const [lastUploadInfo, setLastUploadInfo] = useState(null);
  const [decryptCID, setDecryptCID] = useState("");
  const [decryptKeyB64, setDecryptKeyB64] = useState("");
  const [decryptIvB64, setDecryptIvB64] = useState("");

  // Encryption helpers (AES-GCM 256)
  const generateAesGcmKey = async () => {
    return await window.crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  };

  const exportKeyBase64 = async (key) => {
    const raw = await window.crypto.subtle.exportKey('raw', key);
    return btoa(String.fromCharCode(...new Uint8Array(raw)));
  };

  const encryptFileClientSide = async (file) => {
    const key = await generateAesGcmKey();
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const fileBuf = await file.arrayBuffer();
    const cipherBuf = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      fileBuf
    );
    const keyB64 = await exportKeyBase64(key);
    const ivB64 = btoa(String.fromCharCode(...iv));
    return {
      ciphertext: new Uint8Array(cipherBuf),
      keyB64,
      ivB64,
      name: file.name,
      type: file.type,
      size: file.size
    };
  };

  // Decryption helpers
  const importAesKeyFromBase64 = async (keyB64) => {
    const raw = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0));
    return await window.crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  };

  const decryptAndDownload = async () => {
    if (!decryptCID || !decryptKeyB64 || !decryptIvB64) {
      setMessage('⚠️ Enter CID, Key and IV to decrypt.');
      return;
    }
    try {
      setMessage('⬇️ Fetching encrypted content from IPFS...');
      const res = await fetch(`http://127.0.0.1:8080/ipfs/${decryptCID}`);
      if (!res.ok) throw new Error(`Gateway fetch failed: ${res.status}`);
      const cipherArrayBuf = await res.arrayBuffer();

      const key = await importAesKeyFromBase64(decryptKeyB64);
      const iv = Uint8Array.from(atob(decryptIvB64), c => c.charCodeAt(0));

      setMessage('🔓 Decrypting...');
      const plainBuf = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        cipherArrayBuf
      );

      // Attempt to derive a filename; fallback to CID
      const filename = `${decryptCID}.decrypted`;
      const blob = new Blob([plainBuf]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage('✅ File decrypted and downloaded.');
    } catch (err) {
      setMessage(`❌ Decryption failed: ${err.message}`);
    }
  };

  const loadBlockchain = async () => {
    try {
      const { web3, account, contract } = await initWeb3();
      setWeb3(web3);
      setAccount(account);
      setContract(contract);
      setIpfsContract(contract);

      const user = await contract.methods.users(account).call();
      setIsRegistered(user.exists);
      setIsFraudulent(user.isFraudulent);
      setMessage(user.exists ? "ℹ️ This account is already registered." : "");
      if (user.isFraudulent) {
        setMessage("⚠️ This account is flagged as fraudulent!");
      }
    } catch (error) {
      console.error("❌ Failed to load web3:", error);
      setMessage("❌ Failed to connect to blockchain. Please ensure MetaMask is installed and connected.");
    }
  };

  useEffect(() => {
    loadBlockchain();
    axios.get('http://localhost:5000/roc-data')
      .then(response => {
        setRocData(response.data);
      })
      .catch(error => {
        console.error("Failed to fetch ROC data:", error);
        setMessage("❌ Failed to fetch ROC data. Check server CORS settings.");
      });

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          setIsRegistered(null);
          setIsFraudulent(null);
          setIsLoggedIn(false);
          setCurrentPage("login");
          setMessage("");
          setUserCIDs([]);
          loadBlockchain();
        } else {
          setAccount("");
          setContract(null);
          setMessage("❌ No accounts connected. Please connect MetaMask.");
        }
      });
      window.ethereum.on("chainChanged", () => {
        loadBlockchain();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeAllListeners("accountsChanged");
        window.ethereum.removeAllListeners("chainChanged");
      }
    };
  }, []);

  const switchAccount = async () => {
    if (!window.ethereum) {
      setMessage("❌ MetaMask not detected. Please install MetaMask.");
      return;
    }
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      const accounts = await web3.eth.getAccounts();
      if (accounts.length === 0) {
        setMessage("❌ No accounts selected.");
        return;
      }
      setAccount(accounts[0]);
      setIsRegistered(null);
      setIsFraudulent(null);
      setIsLoggedIn(false);
      setCurrentPage("login");
      setMessage("");
      setUserCIDs([]);
      await loadBlockchain();
    } catch (error) {
      setMessage(`❌ Failed to switch account: ${error.message}`);
    }
  };

  const register = async () => {
    if (!username || !password) {
      setMessage("⚠️ Please enter both username and password.");
      return;
    }

    if (!web3 || !contract || !account) {
      setMessage("❌ Blockchain not initialized. Please check MetaMask connection.");
      return;
    }

    try {
      const chainId = Number(await web3.eth.getChainId());
      if (chainId !== 1337) {
        setMessage(`❌ Wrong network! Please switch to Ganache (Chain ID: 1337). Current Chain ID: ${chainId}`);
        return;
      }

      console.log(`Registering user: ${username} for account: ${account}`);
      const tx = await contract.methods.register(username, password).send({
        from: account,
        gas: 300000,
        gasPrice: await web3.eth.getGasPrice()
      });

      console.log("Registration transaction:", tx);
      setMessage("✅ Registered successfully!");
      setIsRegistered(true);
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(`❌ Registration failed: ${error.message}`);
    }
  };

  const login = async () => {
    if (!username || !password) {
      setMessage("⚠️ Please enter both username and password.");
      return;
    }
    try {
      const result = await contract.methods.login(username, password, new Date().toISOString()).call({ from: account });
      if (result) {
        setMessage("✅ Login successful! Redirecting to upload page...");
        setIsLoggedIn(true);
        setTimeout(() => {
          setCurrentPage("upload");
        }, 2000);
      } else {
        setMessage("❌ Invalid credentials or account is fraudulent");
      }
    } catch (error) {
      setMessage(`❌ Login failed: ${error.message}`);
    }
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentPage("login");
    setUsername("");
    setPassword("");
    setMessage("✅ Logged out successfully!");
    setUserCIDs([]);
  };

  const checkFraud = async () => {
    if (!account) {
      setMessage("❌ Please connect MetaMask first.");
      return;
    }
    try {
      const transaction = {
        Time: 0,
        V1: -1.359807, V2: -0.072781, V3: 2.536346, V4: 1.378155, V5: -0.338321,
        V6: 0.462388, V7: 0.239599, V8: 0.098698, V9: 0.363787, V10: 0.090794,
        V11: -0.551600, V12: -0.617801, V13: -0.991390, V14: -0.311169, V15: 1.468177,
        V16: -0.470401, V17: 0.207971, V18: 0.025791, V19: 0.403993, V20: 0.251412,
        V21: -0.018307, V22: 0.277838, V23: -0.110474, V24: 0.066928, V25: 0.128539,
        V26: -0.189115, V27: 0.133558, V28: -0.021053, Amount: 149.62
      };
      const response = await axios.post('http://localhost:5000/check-fraud', {
        userAddress: account,
        transaction
      });
      if (response.data.isFraud) {
        setMessage(`⚠️ Fraud detected! Tx Hash: ${response.data.txHash}`);
        setIsFraudulent(true);
      } else {
        setMessage("✅ Transaction is legitimate.");
      }
    } catch (error) {
      console.error("Fraud check error:", error.response?.data || error.message);
      setMessage(`❌ Failed to check fraud status: ${error.response?.data?.error || error.message}`);
    }
  };

  const uploadFile = async () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    if (!file) {
      setMessage("❌ Please select a file.");
      return;
    }
    if (!contract || !account) {
      setMessage("❌ Blockchain not initialized.");
      return;
    }
    try {
      setMessage("🔐 Encrypting file...");
      const enc = await encryptFileClientSide(file);

      setMessage("📤 Uploading encrypted file to IPFS (Kubo)...");
      const blob = new Blob([enc.ciphertext], { type: 'application/octet-stream' });
      const { cid } = await ipfs.add(blob);
      const cidString = cid.toString();
      setFileCid(cidString);
      setLastUploadInfo({
        cid: cidString,
        keyB64: enc.keyB64,
        ivB64: enc.ivB64,
        name: enc.name,
        size: enc.size,
        type: enc.type
      });
      setMessage(`✅ Encrypted upload complete. CID: ${cidString}`);

      // Store CID on blockchain
      setMessage("💾 Storing CID on blockchain...");
      await contract.methods.storeCID(cidString).send({ 
        from: account, 
        gas: 200000, 
        gasPrice: await web3.eth.getGasPrice() 
      });
      setMessage(`✅ CID stored on blockchain! CID: ${cidString}`);
      await getCIDs();
    } catch (error) {
      setMessage(`❌ Failed to upload file: ${error.message}`);
    }
  };

  const getCIDs = async () => {
    if (!contract || !account) {
      setMessage("❌ Blockchain not initialized.");
      return;
    }
    try {
      const cids = await contract.methods.getCIDs(account).call();
      setUserCIDs(cids);
      setMessage(`📋 Found ${cids.length} files for this account.`);
    } catch (error) {
      setMessage(`❌ Failed to retrieve CIDs: ${error.message}`);
    }
  };

  const chartData = {
    labels: [],
    datasets: [
      {
        label: `ROC Curve (area = ${rocData.roc_auc.toFixed(2)})`,
        data: rocData.fpr.map((x, i) => ({ x, y: rocData.tpr[i] })),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
        fill: false
      },
      {
        label: 'Random Guess',
        data: Array.from({ length: 101 }, (_, i) => ({ x: i / 100, y: i / 100 })),
        borderColor: '#ef4444',
        borderDash: [5, 5],
        fill: false
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'bottom' },
      title: { display: true, text: 'Receiver Operating Characteristic' }
    },
    scales: {
      x: {
        type: 'linear',
        title: { display: true, text: 'False Positive Rate' },
        min: 0,
        max: 1
      },
      y: {
        type: 'linear',
        title: { display: true, text: 'True Positive Rate' },
        min: 0,
        max: 1.05
      }
    }
  };

  const LoginPage = () => (
    <div className="login-page">
      <h2>User Login/Register DApp</h2>
      <div className="account-info">
        <p><strong>Account:</strong> {account || "Not connected"}</p>
        <p><strong>Fraud Status:</strong> {isFraudulent === null ? "Checking..." : isFraudulent ? "Fraudulent" : "Legitimate"}</p>
        <p><strong>Contract Address:</strong> {contract?._address || "Not loaded"}</p>
        <p><strong>Registered:</strong> {isRegistered === null ? "Checking..." : isRegistered ? "Yes" : "No"}</p>
      </div>
      
      <div className="action-buttons">
        <button onClick={switchAccount}>Switch Account</button>
        <button onClick={checkFraud}>Check Fraud Status</button>
      </div>
      
      <div className="auth-form">
        <input 
          value={username} 
          onChange={(e) => setUsername(e.target.value)} 
          placeholder="Username" 
          type="text" 
        />
        <input 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          placeholder="Password" 
          type="password" 
        />
        <div className="auth-buttons">
          <button onClick={register}>Register</button>
          <button onClick={login}>Login</button>
        </div>
      </div>
      
      {message && <p className="message">{message}</p>}
      
      <div className="chart-container" style={{ width: '600px', margin: '20px auto' }}>
        {rocData.fpr.length > 0 && rocData.tpr.length > 0 && (
          <Line key={JSON.stringify(rocData)} data={chartData} options={chartOptions} />
        )}
      </div>
    </div>
  );

  const UploadPage = () => (
    <div className="upload-page">
      <div className="header">
        <h2>IPFS File Upload</h2>
        <div className="user-info">
          <p><strong>Welcome:</strong> {username}</p>
          <p><strong>Account:</strong> {account}</p>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </div>
      
      <div className="upload-section">
        <h3>Upload Encrypted File to IPFS (Kubo)</h3>
        <div className="upload-controls">
          <input type="file" id="fileInput" />
          <button onClick={uploadFile}>Encrypt & Upload</button>
          <button onClick={getCIDs}>View My Files</button>
        </div>
        
        {fileCid && (
          <div className="file-result">
            <p><strong>Latest Upload:</strong></p>
            <p><strong>CID:</strong> {fileCid}</p>
            <p>
              <strong>View File:</strong> 
              <a href={`http://127.0.0.1:8080/ipfs/${fileCid}`} target="_blank" rel="noopener noreferrer">
                Open in Local Gateway
              </a>
            </p>
            {lastUploadInfo && (
              <div className="encryption-info">
                <p><strong>File Name:</strong> {lastUploadInfo.name} ({(lastUploadInfo.size/1024).toFixed(2)} KB)</p>
                <p><strong>AES-GCM Key (base64):</strong> {lastUploadInfo.keyB64}</p>
                <p><strong>IV (base64):</strong> {lastUploadInfo.ivB64}</p>
                <p><em>Save the key and IV to decrypt later. They are not stored on-chain.</em></p>
              </div>
            )}
          </div>
        )}
        
        {userCIDs.length > 0 && (
          <div className="cid-list">
            <h3>Your Uploaded Files</h3>
            <ul>
              {userCIDs.map((cid, index) => (
                <li key={index}>
                  <a href={`http://127.0.0.1:8080/ipfs/${cid}`} target="_blank" rel="noopener noreferrer">
                    {cid}
                  </a>
                  <button style={{ marginLeft: '8px' }} onClick={() => setDecryptCID(cid)}>Use for Decrypt</button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Decrypt and Download Section */}
      <div className="decrypt-section" style={{ marginTop: '24px' }}>
        <h3>Decrypt & Download</h3>
        <div className="decrypt-controls" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '720px' }}>
          <input type="text" placeholder="CID" value={decryptCID} onChange={(e) => setDecryptCID(e.target.value)} />
          <input type="text" placeholder="AES-GCM Key (base64)" value={decryptKeyB64} onChange={(e) => setDecryptKeyB64(e.target.value)} />
          <input type="text" placeholder="IV (base64)" value={decryptIvB64} onChange={(e) => setDecryptIvB64(e.target.value)} />
          <div>
            <button onClick={decryptAndDownload}>Decrypt & Download</button>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#666' }}>
          AES-GCM key and IV must match the values shown after upload.
        </p>
      </div>
      
      {message && <p className="message">{message}</p>}
      
      <div className="back-to-login">
        <button onClick={() => setCurrentPage("login")}>Back to Login</button>
      </div>
    </div>
  );

  return (
    <div className="App">
      {currentPage === "login" ? (
        <div className="login-page">
          <h2>User Login/Register DApp</h2>
          <div className="account-info">
            <p><strong>Account:</strong> {account || "Not connected"}</p>
            <p><strong>Fraud Status:</strong> {isFraudulent === null ? "Checking..." : isFraudulent ? "Fraudulent" : "Legitimate"}</p>
            <p><strong>Contract Address:</strong> {contract?._address || "Not loaded"}</p>
            <p><strong>Registered:</strong> {isRegistered === null ? "Checking..." : isRegistered ? "Yes" : "No"}</p>
          </div>
          
          <div className="action-buttons">
            <button onClick={switchAccount}>Switch Account</button>
            <button onClick={checkFraud}>Check Fraud Status</button>
          </div>
          
          <div className="auth-form">
            <input 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="Username" 
              type="text" 
            />
            <input 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="Password" 
              type="password" 
            />
            <div className="auth-buttons">
              <button onClick={register}>Register</button>
              <button onClick={login}>Login</button>
            </div>
          </div>
          
          {message && <p className="message">{message}</p>}
          
          <div className="chart-container" style={{ width: '600px', margin: '20px auto' }}>
            {rocData.fpr.length > 0 && rocData.tpr.length > 0 && (
              <Line key={JSON.stringify(rocData)} data={chartData} options={chartOptions} />
            )}
          </div>
        </div>
      ) : (
        <div className="upload-page">
          <div className="header">
            <h2>IPFS File Upload</h2>
            <div className="user-info">
              <p><strong>Welcome:</strong> {username}</p>
              <p><strong>Account:</strong> {account}</p>
              <button onClick={logout} className="logout-btn">Logout</button>
            </div>
          </div>
          
          <div className="upload-section">
            <h3>Upload Encrypted File to IPFS (Kubo)</h3>
            <div className="upload-controls">
              <input type="file" id="fileInput" />
              <button onClick={uploadFile}>Encrypt & Upload</button>
              <button onClick={getCIDs}>View My Files</button>
            </div>
            
            {fileCid && (
              <div className="file-result">
                <p><strong>Latest Upload:</strong></p>
                <p><strong>CID:</strong> {fileCid}</p>
                <p>
                  <strong>View File:</strong> 
                  <a href={`http://127.0.0.1:8080/ipfs/${fileCid}`} target="_blank" rel="noopener noreferrer">
                    Open in Local Gateway
                  </a>
                </p>
                {lastUploadInfo && (
                  <div className="encryption-info">
                    <p><strong>File Name:</strong> {lastUploadInfo.name} ({(lastUploadInfo.size/1024).toFixed(2)} KB)</p>
                    <p><strong>AES-GCM Key (base64):</strong> {lastUploadInfo.keyB64}</p>
                    <p><strong>IV (base64):</strong> {lastUploadInfo.ivB64}</p>
                    <p><em>Save the key and IV to decrypt later. They are not stored on-chain.</em></p>
                  </div>
                )}
              </div>
            )}
            
            {userCIDs.length > 0 && (
              <div className="cid-list">
                <h3>Your Uploaded Files</h3>
                <ul>
                  {userCIDs.map((cid, index) => (
                    <li key={index}>
                      <a href={`http://127.0.0.1:8080/ipfs/${cid}`} target="_blank" rel="noopener noreferrer">
                        {cid}
                      </a>
                      <button style={{ marginLeft: '8px' }} onClick={() => setDecryptCID(cid)}>Use for Decrypt</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Decrypt and Download Section */}
          <div className="decrypt-section" style={{ marginTop: '24px' }}>
            <h3>Decrypt & Download</h3>
            <div className="decrypt-controls" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '720px' }}>
              <input type="text" placeholder="CID" value={decryptCID} onChange={(e) => setDecryptCID(e.target.value)} />
              <input type="text" placeholder="AES-GCM Key (base64)" value={decryptKeyB64} onChange={(e) => setDecryptKeyB64(e.target.value)} />
              <input type="text" placeholder="IV (base64)" value={decryptIvB64} onChange={(e) => setDecryptIvB64(e.target.value)} />
              <div>
                <button onClick={decryptAndDownload}>Decrypt & Download</button>
              </div>
            </div>
            <p style={{ fontSize: '12px', color: '#666' }}>
              AES-GCM key and IV must match the values shown after upload.
            </p>
          </div>
          
          {message && <p className="message">{message}</p>}
          
          <div className="back-to-login">
            <button onClick={() => setCurrentPage("login")}>Back to Login</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;