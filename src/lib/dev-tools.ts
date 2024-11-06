import { APP_INITIALIZER, EnvironmentProviders, Injectable, makeEnvironmentProviders, Signal } from '@angular/core';
import { ActionsSubject, INITIAL_STATE, ReducerObservable, ScannedActionsSubject } from '@ngrx/store';
import { StoreDevtoolsOptions, provideStoreDevtools, StoreDevtools } from '@ngrx/store-devtools';
import { BehaviorSubject, startWith, Subject } from 'rxjs';

import { Events } from './events';
import { WritableStateSource } from '@ngrx/signals';

// Temporary workaround for getting state signal from store
function getValueFromSymbol(obj: unknown, symbol: symbol) {
  if (typeof obj === 'object' && obj && symbol in obj) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return (obj as { [key: symbol]: any })[symbol];
  }
}

function getStoreSignal(store: WritableStateSource<any>): Signal<unknown> {
  const [signalStateKey] = Object.getOwnPropertySymbols(store);
  if (!signalStateKey) {
    throw new Error('Cannot find State Signal');
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return getValueFromSymbol(store, signalStateKey);
}

@Injectable({ providedIn: 'root' })
export class SignalReducerManager {
  stateSignals: Record<string, Signal<any>> = {};

  registerStore(name: string, store: WritableStateSource<any>): void {
    this.stateSignals[name] = getStoreSignal(store);
  }

  getRootState() {
    return Object.entries(this.stateSignals).reduce(
      (acc, [name, store]) => {
        acc[name] = store();
        return acc;
      },
      {} as Record<string, unknown>
    );
  }
}

export function provideSignalStoreDevtools(options: StoreDevtoolsOptions = {}): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideStoreDevtools(options),
    {
      provide: ReducerObservable,
      useFactory: (signalReducerManager: SignalReducerManager) => new BehaviorSubject(() => signalReducerManager.getRootState()),
      deps: [SignalReducerManager],
    },
    {
      provide: ActionsSubject,
      useFactory: (events: Events) => events.on().pipe(startWith({ type: 'INIT' })),
      deps: [Events],
    },
    {
      provide: ScannedActionsSubject,
      useValue: new Subject(),
    },
    {
      provide: INITIAL_STATE,
      useValue: {},
    },
    {
      // just to trigger the init of StoreDevtools
      provide: APP_INITIALIZER,
      useFactory: () => () => undefined,
      multi: true,
      deps: [StoreDevtools],
    },
  ]);
}
