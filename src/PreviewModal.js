import {useState, useEffect} from 'react';

const PreviewModal = ({close, data}) => {
  const [keys, setKeys] = useState(Object.keys(data.row[0]))

  useEffect(() => {
    setKeys(Object.keys(data.row[0]))
  }, [data])
  
  return (
    <div style={{height: '100%', width: '100%', backgroundColor: 'rgba(0,0,0,0.6)', position: 'absolute', zIndex: '100'}}>
      <div class="modal-dialog modal-fullscreen">
        <div class="modal-content">
          <div class="modal-header px-4">
            <h5 class="modal-title">Preview {data.name}</h5>
            <button type="button" class="btn-close" onClick={close} aria-label="Close"></button>
          </div>
          <div class="modal-body">
           <table className="table table-bordered table-hover">
             <thead>
               <tr>{keys.map(key => <th>{key}</th>)}</tr>
             </thead>
             <tbody>
              {data.row.map(point => <tr>
                {keys.map(key => <td>{point[key]}</td>)}
                </tr>
              )}
             </tbody>
           </table>
          </div>
        </div>
      </div>
    </div>
    
  )
}

export default PreviewModal