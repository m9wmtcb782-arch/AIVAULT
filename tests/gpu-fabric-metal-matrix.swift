import Foundation
import Metal
@main
struct MetalMatrixTests {
    struct Case: Decodable {
        let operation: String
        let left: [Float]?
        let right: [Float]?
        let input: [Float]?
        let rows: Int
        let columns: Int
        let inner: Int?
        let transposeRight: Bool?
    }
    struct CaseResult: Encodable { let output: [Float]?; let error: String? }
    struct Reply: Encodable { let device: String; let cases: [CaseResult]; let attention: [Float] }
    static func main() throws {
        guard let device = MTLCreateSystemDefaultDevice() else {
            fputs("BLOCKED: no Metal device\n", stderr); exit(2)
        }
        let compute = try AIVAULTMetalCompute(device: device)
        let cases = try JSONDecoder().decode([Case].self, from: FileHandle.standardInput.readDataToEndOfFile())
        let result = try cases.map { test -> CaseResult in
            do {
                let output: [Float]
                if test.operation == "matmul" {
                    output = try compute.executeMatmul(left: test.left!, right: test.right!, rows: test.rows,
                        inner: test.inner!, columns: test.columns, transposeRight: test.transposeRight ?? false).output
                } else if test.operation == "row_softmax" {
                    output = try compute.executeRowSoftmax(input: test.input!, rows: test.rows, columns: test.columns).output
                } else { throw AIVAULTMetalCompute.ComputeError.unsupportedOperation }
                return CaseResult(output: output, error: nil)
            } catch AIVAULTMetalCompute.ComputeError.invalidInput { return CaseResult(output:nil,error:"invalid_input") }
              catch AIVAULTMetalCompute.ComputeError.executionFailed(_) { return CaseResult(output:nil,error:"execution_failed") }
        }
        // Direct non-JSON NaN/Infinity input checks: these must fail pre-dispatch.
        for value in [Float.nan, Float.infinity, -Float.infinity] {
            var rejected = false
            do { _ = try compute.executeRowSoftmax(input:[value],rows:1,columns:1) }
            catch AIVAULTMetalCompute.ComputeError.invalidInput { rejected = true }
            precondition(rejected)
            rejected = false
            do { _ = try compute.executeMatmul(left:[value],right:[1],rows:1,inner:1,columns:1) }
            catch AIVAULTMetalCompute.ComputeError.invalidInput { rejected = true }
            precondition(rejected)
        }
        // A real local Metal chain, not CPU-injected intermediate values.
        let scores = try compute.executeMatmul(left:[1,0,0,1],right:[1,0,0,1],rows:2,inner:2,columns:2,transposeRight:true)
        let scaled = try compute.execute(operation:"mul_scalar",input:scores.output,scalar:Float(1 / sqrt(2.0)))
        let probabilities = try compute.executeRowSoftmax(input:scaled.output,rows:2,columns:2)
        let attention = try compute.executeMatmul(left:probabilities.output,right:[2,4,6,8],rows:2,inner:2,columns:2)
        let reply = Reply(device:device.name,cases:result,attention:attention.output)
        FileHandle.standardOutput.write(try JSONEncoder().encode(reply))
    }
}
