"""Writes src/test/fixtures/scenario_parity.json: the Python scenario models' outputs for their own scenarios plus
seeded random variants. The TypeScript port (src/services/scenarios.ts) must match them exactly.
Run from atlas/: python scripts/scenario_parity.py  (re-run whenever spec/models/*.py change)."""
import contextlib, hashlib, io, json, os, random, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS = os.path.join(ROOT, "spec", "models")


def load(name):
    src = open(os.path.join(MODELS, name), encoding="utf8").read()
    return src, hashlib.sha256(src.encode("utf8")).hexdigest()


def run(src, split_at, scenarios):
    """Exec the model with its S dict replaced by `scenarios`; returns the model's result dict."""
    head, tail = src.split(split_at, 1)
    ns = {}
    exec(head, ns)
    ns["S"] = scenarios
    cwd = os.getcwd()
    with tempfile.TemporaryDirectory() as tmp, contextlib.redirect_stdout(io.StringIO()):
        os.chdir(tmp)  # combined_v2 writes scen.json
        try:
            exec(split_at + tail, ns)
        finally:
            os.chdir(cwd)
    return ns


rng = random.Random(14)


def projects(n, with_3d=True):
    out = []
    for _ in range(n):
        name = rng.choice(["3D building", "3D sales platform", "Custom software", "Landing site"]) if with_3d else "Custom software"
        out.append((rng.randrange(12), rng.choice([3250, 6000, 6500, 8300, 12000, 14000, 15000]), rng.choice([0, 99, 125, 225, 249, 449, 561]), name))
    return out


def brand_variant():
    return dict(new=[rng.randrange(5) for _ in range(12)], setup=rng.randrange(1000, 3000, 50), mrr=rng.randrange(500, 1300, 10),
                lp=round(rng.uniform(0, 0.6), 2), churn=round(rng.uniform(0.01, 0.08), 3), over=rng.randrange(0, 60, 5), att3d=round(rng.uniform(0, 0.8), 2),
                ar=projects(rng.randrange(5)), sw=projects(rng.randrange(3), False), lps=sorted(rng.sample(range(12), rng.randrange(8))))


def combined_variant():
    v = brand_variant()
    return dict(new=v["new"], setup=v["setup"], mrr=v["mrr"], lp=v["lp"], churn=v["churn"], ar=v["ar"], lps=v["lps"])


by_src, by_sha = load("scenarios_by_brand.py")
co_src, co_sha = load("scenarios_combined_v2.py")

# The models' own scenarios first, then random variants.
by_ns = {}
exec(by_src.split("res={}", 1)[0], by_ns)
co_ns = {}
exec(co_src.split("STAGE=", 1)[0], co_ns)
by_inputs = dict(by_ns["S"])
co_inputs = dict(co_ns["S"])
for i in range(30):
    by_inputs[f"v{i}"] = brand_variant()
    co_inputs[f"v{i}"] = combined_variant()

by_res = run(by_src, "res={}", by_inputs)["res"]
co_res = run(co_src, "STAGE=", co_inputs)["out"]

fixture = {
    "source": {"scenarios_by_brand.py": by_sha, "scenarios_combined_v2.py": co_sha},
    "by_brand": [{"name": k, "input": by_inputs[k], "output": by_res[k]} for k in by_inputs],
    "combined": [{"name": k, "input": co_inputs[k], "output": co_res[k]} for k in co_inputs],
}
out = os.path.join(ROOT, "src", "test", "fixtures", "scenario_parity.json")
os.makedirs(os.path.dirname(out), exist_ok=True)
json.dump(fixture, open(out, "w", encoding="utf8"), indent=1)
print("wrote", out, len(fixture["by_brand"]), "+", len(fixture["combined"]))
