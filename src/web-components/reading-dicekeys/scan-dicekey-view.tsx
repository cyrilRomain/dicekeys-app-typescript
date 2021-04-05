import { observer } from "mobx-react";
import ReactDOM from "react-dom";
import React from "react";
import { CameraCaptureWithOverlay } from "./camera-capture-with-overlay";
import { DiceKeyFrameProcessorState } from "./dice-key-frame-processor";
import { processDiceKeyImageFrame } from "./process-dicekey-image-frame";
import { MediaStreamState } from "./camera-capture-view";
import { CamerasOnThisDevice } from "./cameras-on-this-device";
import { runInAction } from "mobx";

interface CameraSelectionViewProps {
  onCameraSelected?: (camerasDeviceId: string) => any;
}
const CameraSelectionView = observer ( (props: React.PropsWithoutRef<CameraSelectionViewProps>) => {
  const cameras = CamerasOnThisDevice.instance.cameras;
  const defaultDevice = cameras[0];
  if (defaultDevice) {
    runInAction( () => {
      props.onCameraSelected?.(defaultDevice.deviceId);
    });
  }
  return (
    <select value={cameras[0]?.deviceId ?? ""} onChange={ (e) => props.onCameraSelected?.(e.target.value)} >
      { cameras.map( camera => (
        <option key={camera.deviceId} value={camera.deviceId}>{ camera.name }</option>
      ))}
    </select>
  )
});

const ScanDiceKeyView = observer ( (_props: React.PropsWithoutRef<{}>) =>  {
  const frameProcessorState = new DiceKeyFrameProcessorState();
  const mediaStreamState = new MediaStreamState();
  const onFrameCaptured = async (framesImageData: ImageData, canvasRenderingContext: CanvasRenderingContext2D): Promise<void> => {
    frameProcessorState.handleProcessedCameraFrame(await processDiceKeyImageFrame(framesImageData), canvasRenderingContext);
  }
  const onCameraSelected = (deviceId: string ) => {
    const mediaTrackConstraints: MediaTrackConstraints = {
      deviceId,
      width: {
//          ideal: Math.min(camera.capabilities?.width?.max ?? defaultCameraDimensions.width, defaultCameraDimensions.width),
        max: 1280,
          min: 1024,
      },
      height: {
//          ideal: Math.min(camera.capabilities?.height?.max ?? defaultCameraDimensions.height, defaultCameraDimensions.height),
        max: 1280,
          min: 1024
      },
      aspectRatio: {ideal: 1},
      // advanced: [{focusDistance: {ideal: 0}}]
    };
    mediaStreamState.setMediaStreamFromConstraints(mediaTrackConstraints);
  }
  return (
    <div>
      <CameraCaptureWithOverlay {...{onFrameCaptured, mediaStreamState} } />
      <CameraSelectionView {...{onCameraSelected}} />
    </div>
  );
});


(window as {testComponent?: {}}).testComponent = {
  ...((window as {testComponent?: {}}).testComponent ?? {}),
  ScanDiceKeyView: () => {
    ReactDOM.render(<ScanDiceKeyView />, document.getElementById("app-container"))
}};



/*


  render() {
    if (this.cameras.length == 0) {
      if (CamerasOnThisDevice.instance.ready) {
        // We've loaded all the cameras and found there are none
        return (
          <div style={{color: "#ff8080", fontSize: "1.75rem", maxWidth: "70vw"}}>
            Either no cameras are connected or your browser is denying access to them.
            <br/>
            <br/>
            Please make sure cameras are connected, no other apps are using them, and that the app is permitted to access them.
            <br/>
            Then press the refresh button in your browser.
          </div>
        );
      } else {
        // We're still loading the cameras
        return (
          <CamerasBeingInspected />
        )
      }
    } else {
      // Render an overlay and a camera for the video experience
      const [videoElementBounds, setVideoElementRefForBounds] = createReactObservableBounds();
      return (
        <div>
          <div>
            <video ref={ e => { this.videoElement = e; setVideoElementRefForBounds(e) } }/>
            <OverlayCanvas bounds={videoElementBounds} ref={ e => this.overlayCanvasElement = e } />
          </div>
          { // only show a camera selection menu if there's more than one camera to choose from
            this.cameras.length <= 1 ? null : (
            <CenteredControls>
              <select value={this.camerasDeviceId} onChange={ e => this.setCameraByDeviceId(e.target.value) }>
                {CamerasOnThisDevice.instance.cameras.map( camera => (
                <option key={camera.deviceId} value={camera.deviceId}>{camera.name}</option>
                ))}
              </select>
            </CenteredControls>
          )}
        </div>
      );
    }
  }
*/