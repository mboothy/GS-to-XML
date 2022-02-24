const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const ElectronGoogleOAuth2 = require('@getstation/electron-google-oauth2').default;
const fs = require('fs');
const path = require('path');
const {google} = require('googleapis');
const { XMLParser, XMLBuilder, XMLValidator} = require("fast-xml-parser");
const isDev = require('electron-is-dev')
const { autoUpdater } = require('electron-updater');

const Store = require('electron-store');
const { resolve } = require('dns');

//defined the store
let store = new Store();
store.set('output', path.join(__dirname, '../assets/data.xml'))

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = './assets/token.json';

require('@electron/remote/main').initialize()

function createWindow() {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      enableRemoteModule: true,
      contextIsolation: false
    }
  })
  win.once('ready-to-show', () => {
    autoUpdater.checkForUpdatesAndNotify();
  });
  

  win.loadURL(
    isDev
      ? 'http://localhost:3000'
      : `file://${path.join(__dirname, '../build/index.html')}`
  )
  autoUpdater.on('update-available', () => {
    win.webContents.send('update_available');
  });
  autoUpdater.on('update-downloaded', () => {
    win.webContents.send('update_downloaded');
  });
}

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});

app.on('ready', createWindow)

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

ipcMain.on('app-version', (event) => {
  event.sender.send('app-version', { version: app.getVersion() });
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

ipcMain.on('saveRanges', (event,arg) => {
   store.set('ranges', arg.ranges)
    return store.get('ranges')
})

ipcMain.handle('getRanges', (event, arg) => {
  const x = store.get('ranges')
  if(x){
    return x
  } else {
    return []
  }
})
ipcMain.handle('getOutputPath', (event, arg) => {
  const x = store.get('output')
  if(x){
    return x
  } else {
    return ""
  }
})

ipcMain.handle('openFileSave', async (event,arg) => {
  dialog.showSaveDialog({ properties: ['openFile'], filters: [
    { name: "XML files", extensions: ["xml"] },
    { name: "All Files", extensions: ["*"] }
  ]}).then(outputDirectory => {
    if(outputDirectory.cancelled){
      return {cancelled: true}
    } else {
      store.set('output', outputDirectory.filePath)
      return {filePath: outputDirectory.filePath, cancelled: false}  
    }
    
  })
})

ipcMain.handle('previewData', async (event, arg) => {
  return await new Promise((resolve, reject) => {
    const {sheetId, rng} = arg
    let y = {};
  
    fs.readFile('./assets/credentials.json', async (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Sheets API.
      authorize(JSON.parse(content),async (auth) => {
        const x = await getPreviewData(auth, sheetId, rng, y)
        resolve(x)
      });
    })
  
  })
  
})

ipcMain.on('toggleOperation', (event,arg) => {
  operation(arg.status, arg.heartbeat, arg.ranges)
})

let intervals = []
const runEndless = (auth, rangeList) => {const x = setInterval(() => runFile(auth, rangeList), 1000);intervals.push(x)}
const operation = (status,heartbeat = 1000, rangeList) => {
  
  if(status){
    fs.readFile('./assets/credentials.json', (err, content) => {
      if (err) return console.log('Error loading client secret file:', err);
      // Authorize a client with credentials, then call the Google Sheets API.
      authorize(JSON.parse(content), (auth) => runEndless(auth, rangeList));
    });
  } else {
    intervals.map(y => clearInterval(y))
    clearInterval(1)
  }
  
}



/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
 function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);
  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getNewToken(oAuth2Client, credentials.installed,callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}


/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
 function getNewToken(oAuth2Client, creds,callback) {
  const myApiOauth = new ElectronGoogleOAuth2(
    creds.client_id,
    creds.client_secret,
    SCOPES
  );
  myApiOauth.openAuthWindowAndGetTokens()
    .then(token => {
      // use your token.access_token
    
    // oAuth2Client.getToken(code, (err, token) => {
      // if (err) return console.error('Error while trying to retrieve access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    // });
  });
}
//  function getNewToken(oAuth2Client, callback) {
//   const authUrl = oAuth2Client.generateAuthUrl({
//     access_type: 'offline',
//     scope: SCOPES,
//   });
//   console.log('Authorize this app by visiting this url:', authUrl);
//   shell.openExternal(authUrl);
//   let win = new BrowserWindow({ frame: true, width: 400, height: 600 })
//   win.on('close', function () { win = null })
//   win.loadURL(authUrl)
//   win.show()
//     oAuth2Client.getToken(code, (err, token) => {
//       if (err) return console.error('Error while trying to retrieve access token', err);
//       oAuth2Client.setCredentials(token);
//       // Store the token to disk for later program executions
//       fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
//         if (err) return console.error(err);
//         console.log('Token stored to', TOKEN_PATH);
//       });
//       callback(oAuth2Client);
//     });
// }

  

/**
 * Prints the names and majors of students in a sample spreadsheet:
 * @see https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
 * @param {google.auth.OAuth2} auth The authenticated Google OAuth client.
 */



async function runFile(auth, rangeList,) {
  let formatted = {};
  const sheets = google.sheets({version: 'v4', auth});
 
  const runRange = async (sheetId, rng, node) => {
    return new Promise(async (resolve, reject) => {
      const res = (await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: rng
      })).data
        // if (err) return console.log('The API returned an error: ' + err);
      const rows = res.values;
      if (rows.length) {
        const dataName = rows[0][0]
        const formattedName = dataName.replaceAll(' ', '')
        const dataInfo1 = rows[0][1]
        const dataInfo2 = rows[0][2]
        const removeName = rows.shift()
        const headers = rows.shift()
        formatted[node] = {name: dataName, totalRows: rows.length, dataInfo1,dataInfo2}
        formatted[node].row = rows.map(row => {
          let x = {}
          for(var i = 0; i < headers.length; i++){
            x[headers[i]] = row[i]
          }
          // funcFormatted[node].row.push(x)
          return x
        })
        resolve()
      } else {
        console.log('No data found.');
      }
    })
  // console.log(funcFormatted)
  }
  console.log(rangeList)

    await Promise.all(rangeList.map(async range => {
      if(range.active){
        console.log(`running: ${range.sheetId} ${range.rng}`)
        await runRange(range.sheetId,range.rng, range.node)
      }
        // return formatted

      
      console.log('result:')
      console.log(formatted)
      // resolve(formatted)
      return       
    }))


      const builder = new XMLBuilder();
      const xmlContent = await builder.build({DATA: formatted})

      const outputFileName = store.get('output')
    
      fs.writeFile(outputFileName, await xmlContent,(err) => {
          if (err){
            console.log(err);
          }else {
            console.log("File written successfully\n");
          //   console.log(fs.readFileSync(path.join(outputFolderDir, '/openSwimData.xml'), "utf8"));
        }
        
      })
    
      
  }


  const getPreviewData = async(auth, sheetId, rng) => {
    let formatted = {}
    const sheets = google.sheets({version: 'v4', auth});

    const runRange = async (sheetId, rng) => {
      const res = (await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: rng
      })).data
        // if (err) return console.log('The API returned an error: ' + err);
        const rows = res.values;
        if (rows.length) {
          const dataName = rows[0][0]
          const formattedName = dataName.replaceAll(' ', '')
          const removeName = rows.shift()
          const headers = rows.shift()
          formatted = {name: dataName}
          
          formatted.row = rows.map(row => {
            let x = {}
            for(var i = 0; i < headers.length; i++){
              x[headers[i]] = row[i]
            }
            // funcFormatted[formattedName].row.push(x)
            return x
          })
          
          // console.log(funcFormatted)
    
        } else {
          console.log('No data found.');
        }
        // console.log(funcFormatted)
    }
    return runRange(sheetId, rng).then(() => {
      return formatted
    })

  }