package ai.aivault.compute

/** A bounded, synchronous native GLES3 GPU proof; invoke off the UI thread. */
class NativeGpu {
    external fun probe(elements: Int, iterations: Int): String
    companion object {
        init { System.loadLibrary("aivault_gpu") }
    }
}
