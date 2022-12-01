import { endpoint, geoData, requestData, receiveDataSuccess, receiveDataError, requestAddData, receiveAddDataSuccess, receiveAddDataError } from '../store/polygons'
// const createFlash = window.alert

export const fetchPolygonsData = async () => {
    console.log('Call fetchPolygonsData')    
    requestData()
    await self.fetch(`${endpoint}`)
        .then((response) => {
            return response.json()
        })
        .then((data) => {
            receiveDataSuccess(data)
        })
        .catch((error) => {
            receiveDataError(error)
            window.alert('There was an error')
        })
}
