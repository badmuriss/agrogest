export interface CapturedImage { name: string; mime: string; base64: string }
export interface ImageCaptureProps { disabled: boolean; title?: string; onImage: (image: CapturedImage) => Promise<void>; onError: (message: string) => void }
