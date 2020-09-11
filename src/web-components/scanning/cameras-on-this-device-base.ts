import {
  ComponentEvent
} from "../../web-component-framework"

 // Safari may require 640 or 1280, see 
 // https://stackoverflow.com/questions/46981889/how-to-resolve-ios-11-safari-getusermedia-invalid-constraint-issue
 const defaultVideoWidthAndHeightConstraints = {
  width: { ideal: 1024, min: 640 },
  height: { ideal: 1024, min: 640 },
  aspectRatio: {ideal: 1},
  //    advanced: [{focusDistance: {ideal: 0}}]
} as const;


export const videoConstraintsForDevice = (deviceId: string): MediaTrackConstraints => ({
  ...defaultVideoWidthAndHeightConstraints,
  deviceId,
});


export type Camera = MediaDeviceInfo & MediaTrackSettings & {name: string, capabilities: MediaTrackCapabilities};

const getDirectionScore = ({facingMode}: Camera): number =>
  facingMode === "environment" ? -1 : // put cameras facing out first on the list
  typeof facingMode !== "string" ? 0 : // put cameras with an undefined direction next 
  1; // put cameras facing "user", "left", or "right" last;
const getResolutionCapabilitiesScore = ({capabilities}: Camera): number =>
  (capabilities && capabilities.width && capabilities.width.max && capabilities.height && capabilities.height.max) ?
  -capabilities.width.max * capabilities.height.max :
  0;

const compareCameras = (a: Camera, b: Camera): number => {
  const byDirectionScore = getDirectionScore(a) - getDirectionScore(b);
  if (byDirectionScore != 0) return byDirectionScore;
  const byResolutionCapabilitiesScore = getResolutionCapabilitiesScore(a) - getResolutionCapabilitiesScore(b);
  if (byResolutionCapabilitiesScore != 0) return byResolutionCapabilitiesScore;
  const byLabel = a.label?.localeCompare(b.label ?? "") ?? 0;
  return byLabel;
}

export class CamerasOnThisDevice {

  constructor() {
    this.addAttachedAndRemovedDetachedCameras();
    // Start getting a list of cameras
    // Make sure we update the camera list whenever a camera is added or removed
    navigator.mediaDevices.addEventListener('devicechange', () =>
      this.addAttachedAndRemovedDetachedCameras()
    );
    if (CamerasOnThisDevice.camerasByDeviceId.size > 0) {
      // A previous instance of this object already loaded cameras.
      this.updated.send(this.cameras);
    }
  }

  /**
   * An event triggered whenever the list of cameras changes
   */
  public updated = new ComponentEvent<[Camera[]]>(this);

  private camerasToBeAdded = new Map<string, MediaDeviceInfo>();
  private static camerasByDeviceId = new Map<string, Camera>();
  private static unreadableCameraDevices = new Map<string, {cameraDevice: MediaDeviceInfo, exceptions: any[]}>();

  /**
   * A list of cameras sorted by direction (back-facing first, front-facing last)
   * then sorted by label
   */
  public get cameras(): Camera[] {
    const sortedCameras = [...CamerasOnThisDevice.camerasByDeviceId.values()]
      .sort( (a, b) => compareCameras(a, b) );
    return sortedCameras;
  }

  private cameraDeviceIdToCameraNumber = new Map<string, number>();

  tryAddCamera = async (cameraDevice: MediaDeviceInfo): Promise<Camera | undefined> => {
    const {deviceId} = cameraDevice;
    try {
      // Get a media stream so that we can get settings from the track
      const stream = await navigator.mediaDevices.getUserMedia({video: videoConstraintsForDevice(deviceId)});
      if (!stream) return;
      const track = stream.getVideoTracks()[0];
      if (!track) return;
      const settings: MediaTrackSettings = track.getSettings();
      const capabilities: MediaTrackCapabilities = track.getCapabilities();
      stream?.getTracks().forEach(track => track.stop() );
      if (!settings) return;          
      const cameraWithoutName = {
        ...settings,
        ...{capabilities},
        ...cameraDevice,
        // The label (and possibly kind) are not copied via destructuring and must
        // be manually copied.
        kind: cameraDevice.kind,
        label: cameraDevice.label
      };
      const {label, facingMode, width, height} = cameraWithoutName;
      const lcLabel = label.toLocaleLowerCase();
      // Only add a direction string if the direction is present and
      // it's not already implied in the label
      const labelDoesNotContainDirection =
        lcLabel.indexOf("rear") == -1 &&
        lcLabel.indexOf("front") == -1;
      const directionPrefix =
        labelDoesNotContainDirection && facingMode === "user" ? "Front Facing " :
        labelDoesNotContainDirection && facingMode === "environment" ? "Rear Facing " :
        "";
      var identifier: string;
      if (label) {
        identifier = label;
      } else {
        if (this.cameraDeviceIdToCameraNumber.has(deviceId)) {
          identifier = `Camera ${this.cameraDeviceIdToCameraNumber.get(deviceId)!}`;
        } else {
          const cameraIndex = this.cameraDeviceIdToCameraNumber.size +1;
          this.cameraDeviceIdToCameraNumber.set(deviceId, cameraIndex);
          identifier = `Camera ${cameraIndex}`;
        }
      }
      const resolution: string = (width && height) ? ` ${width}x${height} ` : ""
      const name = directionPrefix + identifier + resolution;
      // The label property needs to be set manually
      const camera: Camera = {
        ...cameraWithoutName,
        name
      };
      this.camerasToBeAdded.delete(deviceId);
      CamerasOnThisDevice.unreadableCameraDevices.delete(deviceId);
      CamerasOnThisDevice.camerasByDeviceId.set(deviceId, camera);
      return camera;
    } catch (e) {
      if (CamerasOnThisDevice.unreadableCameraDevices.has(deviceId)) {
        CamerasOnThisDevice.unreadableCameraDevices.get(deviceId)?.exceptions.unshift(e);
      } else {
        CamerasOnThisDevice.unreadableCameraDevices.set(deviceId, {cameraDevice, exceptions: [e]})
      }
    }
    return;
  }

  addAttachedAndRemovedDetachedCameras = async (): Promise<void> => {
    const listOfAllMediaDevices = await navigator.mediaDevices.enumerateDevices();

    const listOfCurrentCameras = listOfAllMediaDevices
      .filter( ({kind}) => kind.toLocaleLowerCase().startsWith('video') );
    const setOfCurrentCamerasDeviceIds = listOfCurrentCameras.reduce( (setOfIds, camera) => {
      setOfIds.add(camera.deviceId)
      return setOfIds;
    }, new Set<string>());

    // Remove cameras no longer on list of media devices (presumably disconnected);
    const deviceIdsOfRemovedCameras = [...CamerasOnThisDevice.camerasByDeviceId.keys()]
      .filter( deviceId => !setOfCurrentCamerasDeviceIds.has(deviceId) );
    for (const deviceIdOfRemovedCamera of deviceIdsOfRemovedCameras) {
      CamerasOnThisDevice.camerasByDeviceId.delete(deviceIdOfRemovedCamera);
    }

    // Add cameras added since this list was last created
    const listOfNewlyAttachedCameras = listOfCurrentCameras.filter(
      ({deviceId}) => !CamerasOnThisDevice.camerasByDeviceId.has(deviceId) && !this.camerasToBeAdded.has(deviceId)
    );
    listOfNewlyAttachedCameras.forEach( camera => this.camerasToBeAdded.set(camera.deviceId, camera) )

    if (this.camerasToBeAdded.size > 0) {
      await Promise.all(
        // do parallel requests for user media to get camera track settings that
        // enumerateDevices doesn't offer, and can only be learned via getUserMedia 
        // followed by getSettings
        [...this.camerasToBeAdded.values()].map( camera => this.tryAddCamera(camera) )
      );
      for (const cameraDevice of this.camerasToBeAdded.values()) {
        // I hope you're as horrified as I am by the use of await in a loop.
        // This is our here by last resort since some devices will not let us
        // inspect cameras in parallel.
        // This could be bad if a device had 50 cameras attached, so um, maybe this
        // is an intentional plot to accidentally take down surveillance systems that
        // might accidentally run this code?  Yeah, that's the ticket!
        await this.tryAddCamera(cameraDevice);
      }
    }
    if (deviceIdsOfRemovedCameras.length > 0 || listOfNewlyAttachedCameras.length > 0) {
      // A change to the list has been made so send an update event
      this.updated.send(this.cameras);
    }
  }

}