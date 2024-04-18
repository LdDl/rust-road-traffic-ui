import type { Zone } from "./zones";

export const saveTOML = (baseURL: string, dataToSave: [string, Zone][]) => {
    const sendData = {
        // Should send only zones with both canvas and spatial object IDs
        data: dataToSave.map(e => {
            const element = e[1]
            return {
                lane_number: element.properties.road_lane_num,  
                lane_direction: element.properties.road_lane_direction,
                color_rgb: element.properties.color_rgb,
                pixel_points: element.properties.coordinates,
                spatial_points: [...element.geometry.coordinates[0].slice(0, -1)],
                virtual_line: element.properties.virtual_line ? {
                    geometry: element.properties.virtual_line.geometry,
                    color_rgb: element.properties.virtual_line.color_rgb,
                    direction: element.properties.virtual_line.direction
                } : null
            };
        })
    };
    console.log('Replacing data')
    const endpointReplace = `${baseURL}/api/mutations/replace_all`
    fetch(`${endpointReplace}`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(sendData)})
        .then((response) => {
            return response.json()
        })
        .then((data) => {
            const endpointSave = `${baseURL}/api/mutations/save_toml`
            console.log('Replacing configuration with polygons:', data)
            fetch(`${endpointSave}`, {method: 'GET'})
                .then((response) => {
                    return response.json()
                })
                .then((data) => {
                    console.log("Configuration has been updated. Reply from server:", data)
                })
                .catch((error) => {
                    console.log('Error on updating configuration:', error)
                })
        })
        .catch((error) => {
            console.log('Error on replacing data', error)
        })
}