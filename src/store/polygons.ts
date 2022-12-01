// import axios from 'axios'

// const apiURL = 'http://localhost:42001'

// export async function getPolygons() {
//     return await axios({
//         method: 'GET',
//         url: `${apiURL}/api/polygons/geojson`,
//         timeout: 5000,
//         headers: {
//             'Content-Type': 'application/json'
//         }
//     })
//     .then(res => res.data)
//     .catch (err => console.error(err));
// }

import { writable } from 'svelte/store'

export const apiURL = 'http://localhost:42001'
export const endpoint = `${apiURL}/api/polygons/geojson`
export const isLoading = writable(false)
export const error = writable(null)
export const isAddingData = writable(false)
export const errorAddingData = writable(false)
export const geoData = writable({})

export const requestData = () => isLoading.set(true)

export const receiveDataSuccess = (data: any) => {
	// Do any needed data transformation to the received payload here
    console.log('Loaded data', data)
	geoData.set(data)
	isLoading.set(false)
}
export const receiveDataError = (error: any) => {
	// handle error
	isLoading.set(false)
}

export const requestAddData = (data: any) => {
	isAddingData.set(true)
}
export const receiveAddDataSuccess = (data: any) => {
	// Do any needed data transformation to the received payload here
	isAddingData.set(false)
	// geoData.update(geoData => ([...geoData, ...geoData]))
}

export const receiveAddDataError = (error: any) => {
	isAddingData.set(false)
    errorAddingData.set(error)
}