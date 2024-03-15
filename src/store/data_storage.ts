import { writable } from 'svelte/store';

export const dataStorage = writable(new Map())

export function updateDataStorage(key: any, value: any) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map(currentHashmap);
      updatedHashmap.set(key, value);
      return updatedHashmap;
    });
}

export function deleteFromDataStorage(key: any) {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map(currentHashmap);
      updatedHashmap.delete(key);
      return updatedHashmap;
    });
}

export function clearDataStorage() {
    dataStorage.update(currentHashmap => {
      const updatedHashmap = new Map(currentHashmap);
      updatedHashmap.clear();
      return updatedHashmap;
    });
}
