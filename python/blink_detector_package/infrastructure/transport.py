import json
import queue
import sys
import threading


class NdjsonTransport:
    def __init__(self, input_stream=None, output_stream=None):
        self.input_stream = input_stream or sys.stdin
        self.output_stream = output_stream or sys.stdout
        self.command_queue = queue.Queue()

    def send(self, payload):
        print(json.dumps(payload), file=self.output_stream)
        self.output_stream.flush()

    def send_serialized(self, payload):
        print(payload, file=self.output_stream)
        self.output_stream.flush()

    def start_input_thread(self):
        input_handler = threading.Thread(target=self._read_input, daemon=True)
        input_handler.start()
        return input_handler

    def _read_input(self):
        self.send({"debug": "Input thread started"})
        while True:
            try:
                line = self.input_stream.readline()
                if line:
                    stripped_line = line.strip()
                    self.command_queue.put(stripped_line)
                    self.send(
                        {"debug": f"Received command: {stripped_line}"}
                    )
            except Exception as error:
                self.send({"debug": f"Input thread error: {str(error)}"})
                break
