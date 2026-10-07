import Foundation
import Vision
import AppKit
let arguments = CommandLine.arguments.dropFirst()
for path in arguments {
    guard let image = NSImage(contentsOfFile:path), let cg = image.cgImage(forProposedRect:nil,context:nil,hints:nil) else { continue }
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["ko-KR", "en-US"]
    request.usesLanguageCorrection = false
    do {
        try VNImageRequestHandler(cgImage:cg,options:[:]).perform([request])
        let lines = (request.results ?? []).compactMap { item -> [String:Any]? in
            guard let candidate = item.topCandidates(1).first else {return nil}
            let b = item.boundingBox
            return ["text":candidate.string,"confidence":candidate.confidence,"x":b.minX,"y":1-b.maxY,"w":b.width,"h":b.height]
        }
        let data = try JSONSerialization.data(withJSONObject:lines,options:[.prettyPrinted,.sortedKeys])
        try data.write(to:URL(fileURLWithPath:path+".json"))
        print(path,lines.count)
    } catch { fputs("OCR error: \(error)\n",stderr);exit(1) }
}
