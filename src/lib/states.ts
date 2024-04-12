export enum States {
    AddingZoneCanvas = 1,
    AddingZoneMap,
    Waiting,
    EditingZone,
    DeletingZoneCanvas,
    DeletingZoneMap,
    PickPolygon
}

export enum SubscriberState {
    Init = 'init',
    ReInit = 're-init'
}