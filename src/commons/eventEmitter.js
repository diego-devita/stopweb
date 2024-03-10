import { EventEmitter } from 'events';

class EventEmitterSingleton {
  constructor() {
    if (!EventEmitterSingleton.instance) {
      EventEmitterSingleton.instance = new EventEmitter();
    }
  }

  getInstance() {
    return EventEmitterSingleton.instance;
  }
}

const instance = new EventEmitterSingleton();
Object.freeze(instance);

export default instance;
