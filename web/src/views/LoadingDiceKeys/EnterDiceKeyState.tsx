import { action, makeAutoObservable } from "mobx";
import {
  Face,
  DiceKeyFaces,
  validateDiceKey,
  PartialDiceKey,
  DiceKeyWithoutKeyId
} from "../../dicekeys/DiceKey";
import { FaceDigit, FaceLetter, FaceOrientationLetterTrbl, FaceOrientationLetterTrblOrUnknown } from "@dicekeys/read-dicekey-js";


export class EnterDiceKeyState {
  currentFaceIndex: number = 0;

  usedLetters: string = "";

  get isValid(): boolean {
    return validateDiceKey(this.partialDiceKey)!!;
  }

  get diceKey(): DiceKeyWithoutKeyId | undefined {
    return validateDiceKey(this.partialDiceKey) ? new DiceKeyWithoutKeyId(this.partialDiceKey as DiceKeyFaces) : undefined;
  }

  readonly partialDiceKey: PartialDiceKey = PartialDiceKey(Array.from({ length: 25 }, () => ({ orientationAsLowercaseLetterTrbl: 't' } as Partial<Face>)));

  constructor() {
    makeAutoObservable(this);
  }

  private get currentFace(): Partial<Face> { return this.partialDiceKey![this.currentFaceIndex]!; }
  private get previousFaceIndex(): number { return (this.currentFaceIndex! + 24) % 25; }
  private get nextFaceIndex(): number { return (this.currentFaceIndex! + 1) % 25; }
  private get nextFace(): Partial<Face> { return this.partialDiceKey[this.nextFaceIndex]!; }

  setCurrentFaceIndex = action((index: number) => {
    this.currentFaceIndex = index;
  });

  keyDownListener = action((event: KeyboardEvent) => {
    const upperKey = event.key.toUpperCase();
    if (FaceLetter.isValid(upperKey) && !this.usedLetters.includes(upperKey)) {
      if (this.currentFace.letter != null && this.currentFace.digit != null && this.nextFace.letter == null) {
        this.currentFaceIndex = this.nextFaceIndex;
      }
      if (this.currentFace.letter != null) {
        this.usedLetters.replace(this.currentFace.letter, upperKey);
      } else {
        this.usedLetters += upperKey;
      }
      this.currentFace.letter = upperKey;
    } else if (FaceDigit.isValid(upperKey)) {
      if (this.currentFace.letter != null && this.currentFace.digit != null && this.nextFace.digit == null) {
        this.currentFaceIndex = this.nextFaceIndex;
      }
      this.currentFace.digit = upperKey;
    } else if (((event.shiftKey || event.ctrlKey) && event.code === "ArrowRight") ||
      event.key === "+" ||
      event.key === "=" ||
      event.key === "]" ||
      event.key === "." ||
      event.key === ">" ||
      event.key === "'") {
      // Rotate right
      this.currentFace.orientationAsLowercaseLetterTrbl =
        FaceOrientationLetterTrblOrUnknown.rotate(this.currentFace.orientationAsLowercaseLetterTrbl ?? 't', 1) as FaceOrientationLetterTrbl ?? 't';
    } else if (((event.shiftKey || event.ctrlKey) && event.code === "ArrowLeft") ||
      event.key === "_" ||
      event.key === "-" ||
      event.key === "[" ||
      event.key === "," ||
      event.key === "<" ||
      event.key === ";") {
      // Rotate left
      this.currentFace.orientationAsLowercaseLetterTrbl =
        FaceOrientationLetterTrblOrUnknown.rotate(this.currentFace.orientationAsLowercaseLetterTrbl ?? 't', 3) as FaceOrientationLetterTrbl ?? 't';
    } else if (event.code === "ArrowUp") {
      // Move up ( index -= 5 % 25 )
      this.currentFaceIndex = (this.currentFaceIndex! + 20) % 25;
    } else if (event.code === "ArrowDown") {
      // Move down ( index += 5 % 25 )
      this.currentFaceIndex = (this.currentFaceIndex! + 5) % 25;
    } else if (event.code === "ArrowLeft" || ((event.shiftKey || event.ctrlKey) && (event.code === "Tab" || event.code === "Space"))) {
      // Move left
      this.currentFaceIndex = this.previousFaceIndex;
    } else if (event.code === "ArrowRight" || ((!event.shiftKey && !event.ctrlKey) && (event.code === "Tab" || event.code === "Space"))) {
      // Move right
      this.currentFaceIndex = this.nextFaceIndex;
    } else if (event.code === "Delete") {
      delete this.currentFace.letter;
      delete this.currentFace.digit;
      this.currentFace.orientationAsLowercaseLetterTrbl = 't';
    } else if (event.code === "Backspace") {
      if (this.currentFace.letter == null && this.currentFace.digit == null) {
        this.currentFaceIndex = this.previousFaceIndex;
      } else {
        delete this.currentFace.letter;
        delete this.currentFace.digit;
        this.currentFace.orientationAsLowercaseLetterTrbl = 't';
      }
    } else if (event.code === "Home") {
      this.currentFaceIndex = 0;
    } else if (event.code === "End") {
      this.currentFaceIndex = 24;
    } else {
      // No key found.  Do nothing and allow (DO NOT prevent) default
      return;
    }
    event.preventDefault();
  });
}
