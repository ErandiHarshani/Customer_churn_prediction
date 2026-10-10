"""Convenience entrypoint: python scripts/run_seed.py [--reset]"""
import runpy

runpy.run_module("app.seed", run_name="__main__")
