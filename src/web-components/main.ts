import {
  HtmlComponent
} from "./html-component"

import {
  RequestForUsersConsent,
  UsersConsentResponse,
} from "@dicekeys/dicekeys-api-js";
// import {
//   ComponentEvent
// } from "./component-event";
import {
  DisplayDiceKeyCanvas
} from "./display-dicekey-canvas";
import {
  HomeComponent
} from "./home-component";
import {
  ConfirmationDialog
} from "./confirmation-dialog";
import {
  DerivationOptionsDialog
} from "./derivation-options-dialog";
import {
  Exceptions
} from "@dicekeys/dicekeys-api-js"
import {
  ReadDiceKey
} from "./read-dicekey";
import {
  DiceKey
} from "../dicekeys/dicekey";
import {
  DiceKeyAppState
} from "../state/app-state-dicekey"
import {
  Step
} from "../state"
import {
  PostMessagePermissionCheckedMarshalledCommands
} from "../api-handler/post-message-permission-checked-marshalled-commands";
import { SeededCryptoModulePromise } from "@dicekeys/seeded-crypto-js";
import { RequestForUsersConsentFn } from "../api-handler/api-permission-checks";
import {
  GetUsersApprovalAndModificationOfDerivationOptions, UsersApprovalAndModificationOfDerivationOptionsParameters
} from "../api-handler/permission-checked-seed-accessor";
import { ProofOfPriorDerivationModule } from "../api-handler/mutate-derivation-options";


interface BodyOptions {
  appState: DiceKeyAppState;
}

export class AppMain extends HtmlComponent<BodyOptions, HTMLElement> {
  appState: DiceKeyAppState;

//  action: PageAction = "home";

  constructor(options: BodyOptions) {
    super(options, document.body);
    const {appState} = options;
    this.appState = appState;
    
    window.addEventListener("message", messageEvent => this.handleApiMessageEvent(messageEvent) );
    // Let the parent know we're ready for messages. // FIXME document in API
    if (window.opener) {
      // Using origin "*" is dangerous, but we allow it only to let the window
      // that opened the app know that the window it opened had loaded.
      window.opener?.postMessage("ready", "*");
    }
  }

  handleApiMessageEvent = async (messageEvent: MessageEvent) => {
    const serverApi = new PostMessagePermissionCheckedMarshalledCommands(
      messageEvent,
      await SeededCryptoModulePromise,
      this.loadDiceKey,
      this.requestUsersConsent,
      this.getUsersApprovalAndModificationOfDerivationOptions,
    );
    if (serverApi.isCommand()) {
      await serverApi.execute();
      const windowName = messageEvent?.data?.windowName;
      // Try to send focus back to calling window.
      if (typeof windowName === "string") {
        const windowOpener = window.opener;// window.open("", windowName);
        windowOpener?.focus();
      }
    }
  };


  loadDiceKey = async (): Promise<DiceKey> => {
    const diceKey = DiceKeyAppState.instance?.diceKey;
    if (diceKey) {
      return diceKey;
    }
    this.renderSoon(); 
    return await Step.loadDiceKey.start();
  }

  requestUsersConsent: RequestForUsersConsentFn = (
    requestForUsersConsent: RequestForUsersConsent
  ) => {
    this.renderSoon();
    return Step.getUsersConsent.start(requestForUsersConsent);
  }

  getUsersApprovalAndModificationOfDerivationOptions: GetUsersApprovalAndModificationOfDerivationOptions = (
    parameters: UsersApprovalAndModificationOfDerivationOptionsParameters
  ) => {
    this.renderSoon();
    return Step.getUsersApprovedDerivationOptions.start(parameters);
  }

  async render() {
    super.render();
    const diceKey = this.appState.diceKey;
    if (Step.getUsersConsent.isInProgress) {
      
      const confirmationDialog = this.addChild(
        new ConfirmationDialog({requestForUsersConsent: Step.getUsersConsent.options})
      );
      confirmationDialog
        .allowChosenEvent.on( () => Step.getUsersConsent.complete(UsersConsentResponse.Allow) )
        .declineChosenEvent.on( () => Step.getUsersConsent.cancel(UsersConsentResponse.Deny) )
      Step.getUsersConsent.promise?.finally( () => this.renderSoon() );

    } else if (Step.getUsersApprovedDerivationOptions.isInProgress) {
      
      this.addChild(
        new DerivationOptionsDialog(
          await ProofOfPriorDerivationModule.instancePromise,
          Step.getUsersApprovedDerivationOptions.options
        )
      )
      .userApprovedEvent.on( Step.getUsersApprovedDerivationOptions.complete )
      .userCancelledEvent.on( Step.getUsersApprovedDerivationOptions.cancel )
      Step.getUsersApprovedDerivationOptions.promise?.finally( this.renderSoon );
    } else if (Step.loadDiceKey.isInProgress) {
      const readDiceKey = this.addChild(new ReadDiceKey());
      readDiceKey.diceKeyLoadedEvent.on( Step.loadDiceKey.complete );
      readDiceKey.userCancelledEvent.on( () => Step.loadDiceKey.cancel(
        new Exceptions.UserCancelledLoadingDiceKey()
      ));
      Step.loadDiceKey.promise?.finally( () => this.renderSoon() );

    } else if (diceKey) {
      const displayCanvas = this.addChild(new DisplayDiceKeyCanvas({diceKey}));
      displayCanvas.forgetEvent.on( () => this.renderSoon() );

    } else {
      const homeComponent = this.addChild(new HomeComponent());
      homeComponent.loadDiceKeyButtonClicked.on( () => {
        this.loadDiceKey();
      });

    }
  }

}