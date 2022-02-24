import { useState, useEffect } from 'react'
import PreviewModal from './PreviewModal';
// import ElectronGoogleOAuth2 from '@getstation/electron-google-oauth2';
// const fs = require('fs')
const { ipcRenderer } = window.require('electron');


function App() {
  
  const [rangeList, setRangeList] = useState([])
  const [rngFormSheet, setRngFormSheet] = useState("")
  const [rngFormRange, setRngFormRange] = useState("") 
  const [rngFormName, setRngFormName] = useState("") 
  const [rngFormNodeName, setRngFormNodeName] = useState("") 
  const [running, setRunning] = useState(false)
  const [outputDestination, setOutputDestination] = useState('')
  const [modal, setModal] = useState(false)
  const [modalData, setModalData] = useState()
  const [version, setVersion] = useState()

  ipcRenderer.send('app-version')
  ipcRenderer.on('app_version', (event, arg) => {
    
    setVersion('V' + arg.version);
  });


  const getRanges = async () => {
    ipcRenderer.invoke('getRanges').then((res) => {
      setRangeList(res)
    })
  }
  const getOutputPath = async () => {
    ipcRenderer.invoke('getOutputPath').then((res)=> {
      setOutputDestination(res)
    })
  }
  useEffect(() => {
    getRanges()
    getOutputPath()

  }, [])
  
  const addRange = (e) => {
    e.preventDefault();
    const x = [...rangeList,{sheetId: rngFormSheet, rng: rngFormRange, name: rngFormName, node: rngFormNodeName, active: false}]
    setRangeList(x)
    ipcRenderer.send('saveRanges', {ranges: x})
    setRngFormRange("")
    setRngFormSheet('')
    setRngFormName('')
  }
  const deleteRange = (id) => {
    if(!running){
      const x = rangeList
      const filteredX = x.filter(range => (`${range.sheetId}${range.rng}`) !== id)
      setRangeList(filteredX)
      ipcRenderer.send('saveRanges', {ranges: filteredX})
    }
  }
  const toggleActiveRange = (range) => {
    // const nameAndRange = id.split('--')
    const x = rangeList
    const xId = x.indexOf(range)
    x[xId].active = !x[xId].active
    ipcRenderer.send('saveRanges', {ranges: x})
  }

  const operationStart = () => {
    ipcRenderer.send('toggleOperation', {status: true, heartbeat: 1000, ranges: rangeList})
    setRunning(true)
  }
  const operationStop = () => {
    ipcRenderer.send('toggleOperation', {status: false, heartbeat: 1000})
    setRunning(false)
  }

  const openFileSave = async () => {
   ipcRenderer.invoke('openFileSave').then(res => {
    if(res){
      setOutputDestination(res.filePath)
    }
   })
      
  }


  const previewRange = (rangeIdent) => {
    const x = rangeIdent.split('--')
    const sheetId = x[0]
    const rng = x[1]
    ipcRenderer.invoke('previewData', {sheetId, rng}).then(res => {
      console.log(res)
      setModalData(res,setModal(true))
      
    })
  }

  const [notifMsg, setNotifMsg] = useState("")
  const [showNotifRestart, setShowNotifRestart] = useState(false)
  const [showNotif, setShowNotif] = useState(false)

  ipcRenderer.on('update_available', () => {
    ipcRenderer.removeAllListeners('update_available');
    setNotifMsg('A new update is available. Downloading now...');
    showNotif(true)
  });
  ipcRenderer.on('update_downloaded', () => {
    ipcRenderer.removeAllListeners('update_downloaded');
    setNotifMsg('Update Downloaded. It will be installed on restart. Restart now?');
    showNotifRestart(true)
    showNotif(true)
  });
  function restartApp() {
    ipcRenderer.send('restart_app');
  }


  return (
    <>
    <div id="notification" class={`${showNotif ? '' : 'hidden'}`}>
      <p id="message">{notifMsg}</p>
      <button id="close-button" onClick={() => showNotif(false)}>
        Close
      </button>
      <button id="restart-button" onClick={restartApp()} class={`${showNotifRestart ? '' : 'hidden'}`}>
        Restart
      </button>
    </div>

    {modal && modalData ? <PreviewModal data={modalData} close={() => setModal(false)} /> : ''}
    <div className="container mt-2">
      <h1>Google Sheets to XML - {version}</h1>
      <div className="operation">
        <h4>Operation: </h4>
        <div className="outputPath">
          <h6>File Output:</h6> 
          <span>{outputDestination} </span>
          <button onClick={openFileSave} className="btn btn-sm btn-warning inline">Change</button>
        </div>
        {!running? 
          <button className="btn btn-success" onClick={operationStart}>Start Operation</button>
          : <button className="btn btn-danger" onClick={operationStop}>Stop Operation</button>
        }
      </div>
      
      <h4 className='mt-4'>Add Range</h4>
      <form className="form-group mb-2 row g-3">
        <div className="col">
          <input
            value={rngFormName}
            onChange={event => setRngFormName(event.target.value)}
            className="form-control form-control-sm"
            placeholder="Name"
          />
        </div>
        <div className="col">
          <input
            value={rngFormNodeName}
            onChange={event => setRngFormNodeName(event.target.value)}
            className="form-control form-control-sm"
            placeholder="Node Name"
          />
        </div>
        <div className="col">
          <input
            value={rngFormSheet}
            onChange={event => setRngFormSheet(event.target.value)}
            className="form-control form-control-sm"
            placeholder="Sheet ID"
          />
        </div>
        <div className="col">
          <input
            value={rngFormRange}
            onChange={event => setRngFormRange(event.target.value)}
            className="form-control form-control-sm"
            placeholder="Cell Range"
          />
        </div>
        <div className="col">
          <button disabled={running} onClick={e => addRange(e)} className="btn btn-success">Add</button>
        </div>
      </form>

      <div className="rangeList">
        <h4 className='mt-4'>Active Ranges</h4>
        <table class="table table-sm table-hover">
        <thead>
          <tr>
            <th>Active?</th>
            <th>Name</th>
            <th>Node</th>
            <th>Sheet ID</th>
            <th>Sheet Range</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rangeList.length >= 1 ?rangeList.map(range => <>
            <tr key={`${range.name}${range.sheetId}${range.rng}`}>
              <td><input type="checkbox" checked={range.active} onChange={() => toggleActiveRange(range)} name={`${range.name}${range.sheetId}${range.rng}Active`} id={`${range.name}${range.sheetId}${range.rng}Active`} /></td>
              <td>{range.name}</td>
              <td>{range.node}</td>
              <td>{range.sheetId}</td>
              <td>{range.rng}</td>
              <td>
                <div className={`btn-hover text-${running? 'muted': 'danger'}`} onClick={() => deleteRange(`${range.sheetId}${range.rng}`)}>
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M17 5V4C17 2.89543 16.1046 2 15 2H9C7.89543 2 7 2.89543 7 4V5H4C3.44772 5 3 5.44772 3 6C3 6.55228 3.44772 7 4 7H5V18C5 19.6569 6.34315 21 8 21H16C17.6569 21 19 19.6569 19 18V7H20C20.5523 7 21 6.55228 21 6C21 5.44772 20.5523 5 20 5H17ZM15 4H9V5H15V4ZM17 7H7V18C7 18.5523 7.44772 19 8 19H16C16.5523 19 17 18.5523 17 18V7Z"
                      fill="currentColor"
                    />
                    <path d="M9 9H11V17H9V9Z" fill="currentColor" />
                    <path d="M13 9H15V17H13V9Z" fill="currentColor" />
                  </svg>
                </div>
                <div className="btn-hover" onClick={()=> previewRange(`${range.sheetId}--${range.rng}`)}>
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M16 12C16 14.2091 14.2091 16 12 16C9.79086 16 8 14.2091 8 12C8 9.79086 9.79086 8 12 8C14.2091 8 16 9.79086 16 12ZM14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12Z"
                      fill="currentColor"
                    />
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M12 3C17.5915 3 22.2898 6.82432 23.6219 12C22.2898 17.1757 17.5915 21 12 21C6.40848 21 1.71018 17.1757 0.378052 12C1.71018 6.82432 6.40848 3 12 3ZM12 19C7.52443 19 3.73132 16.0581 2.45723 12C3.73132 7.94186 7.52443 5 12 5C16.4756 5 20.2687 7.94186 21.5428 12C20.2687 16.0581 16.4756 19 12 19Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <div className="btn-hover" onClick={() => editRange(`${range.sheetId}--${range.rng}`)}>
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fill-rule="evenodd"
                      clip-rule="evenodd"
                      d="M21.2635 2.29289C20.873 1.90237 20.2398 1.90237 19.8493 2.29289L18.9769 3.16525C17.8618 2.63254 16.4857 2.82801 15.5621 3.75165L4.95549 14.3582L10.6123 20.0151L21.2189 9.4085C22.1426 8.48486 22.338 7.1088 21.8053 5.99367L22.6777 5.12132C23.0682 4.7308 23.0682 4.09763 22.6777 3.70711L21.2635 2.29289ZM16.9955 10.8035L10.6123 17.1867L7.78392 14.3582L14.1671 7.9751L16.9955 10.8035ZM18.8138 8.98525L19.8047 7.99429C20.1953 7.60376 20.1953 6.9706 19.8047 6.58007L18.3905 5.16586C18 4.77534 17.3668 4.77534 16.9763 5.16586L15.9853 6.15683L18.8138 8.98525Z"
                      fill="currentColor"
                    />
                    <path
                      d="M2 22.9502L4.12171 15.1717L9.77817 20.8289L2 22.9502Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
              </td>
            </tr>
          
          </>) : <tr colspan="3">No Ranges Added</tr>}
        </tbody>
        </table>
      </div>
    </div>
    </>
  )
}


export default App
