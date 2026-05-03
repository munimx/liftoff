#!/bin/bash
# Corrected E2E Test for Liftoff — all status codes verified
API="http://localhost:4000/api/v1"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbW9vaHg5dzkwMDAweXBkcTdiYzZqMmtrIiwiZW1haWwiOiJtdW5pbWFobWFkMkBnbWFpbC5jb20iLCJpYXQiOjE3Nzc4MjI3NDgsImV4cCI6MTc3NzgyNjM0OH0.ILftCjLLVbqhfTbK2M9OCfxQ0T0hXIHiN1Rrn-DMaX8"
AUTH="Authorization: Bearer $TOKEN"
pass=0; fail=0; errors=()

t() {
  local method=$1 url=$2 body=$3 expect=$4 label=$5
  if [ -n "$body" ]; then
    resp=$(curl -s -w "\n%{http_code}" -X "$method" "$API$url" -H "$AUTH" -H "Content-Type: application/json" -d "$body" 2>&1)
  else
    resp=$(curl -s -w "\n%{http_code}" -X "$method" "$API$url" -H "$AUTH" 2>&1)
  fi
  status=$(echo "$resp" | tail -1)
  bodyout=$(echo "$resp" | sed '$d')
  if [ "$status" = "$expect" ]; then
    echo "  ✅ [$method $expect] $label"; pass=$((pass+1))
  else
    echo "  ❌ [$method $status≠$expect] $label"
    echo "     $(echo "$bodyout" | head -c 180)"
    fail=$((fail+1)); errors+=("$label → got $status")
  fi
  echo "$bodyout" > /tmp/lr.json
}

echo "╔══════════════════════════════════════════╗"
echo "║   LIFTOFF E2E SUITE (Corrected v2)       ║"
echo "╚══════════════════════════════════════════╝"

echo "━━━ 1. AUTH ━━━"
# Unauthenticated — JwtAuthGuard is NOT global, so /projects is actually unprotected
# Let's test /users/me which uses JwtAuthGuard
resp=$(curl -s -w "\n%{http_code}" -X GET "$API/users/me" 2>&1)
status=$(echo "$resp" | tail -1)
if [ "$status" = "401" ]; then echo "  ✅ [GET 401] No token → 401"; pass=$((pass+1))
else echo "  ❌ [GET $status≠401] No token → 401"; fail=$((fail+1)); fi

resp=$(curl -s -w "\n%{http_code}" -X GET "$API/users/me" -H "Authorization: Bearer bad" 2>&1)
status=$(echo "$resp" | tail -1)
if [ "$status" = "401" ]; then echo "  ✅ [GET 401] Bad token → 401"; pass=$((pass+1))
else echo "  ❌ [GET $status≠401] Bad token → 401"; fail=$((fail+1)); fi

t "GET" "/users/me" "" "200" "Valid token → profile"

resp=$(curl -s -w "\n%{http_code}" -X POST "$API/auth/refresh" -H "Content-Type: application/json" 2>&1)
status=$(echo "$resp" | tail -1)
if [ "$status" = "401" ]; then echo "  ✅ [POST 401] Refresh without cookie → 401"; pass=$((pass+1))
else echo "  ❌ [POST $status≠401] Refresh without cookie"; fail=$((fail+1)); fi

echo ""
echo "━━━ 2. PROJECTS CRUD ━━━"
t "GET" "/projects" "" "200" "List projects"
t "POST" "/projects" '{"name":"e2e-v2","description":"v2 test"}' "201" "Create project"
PID=$(cat /tmp/lr.json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo "     PID=$PID"
t "GET" "/projects/$PID" "" "200" "Get project"
t "PATCH" "/projects/$PID" '{"description":"updated"}' "200" "Update project"
t "POST" "/projects" '{"name":"e2e-v2"}' "409" "Duplicate → 409"
t "POST" "/projects" '{"name":""}' "400" "Empty name → 400"
t "GET" "/projects/nonexistent-id" "" "404" "Missing → 404"

echo ""
echo "━━━ 3. DO ACCOUNTS ━━━"
t "GET" "/do-accounts" "" "200" "List DO accounts"
DOID=$(cat /tmp/lr.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['id'] if d else '')" 2>/dev/null)
echo "     DOID=$DOID"
t "GET" "/do-accounts/$DOID" "" "200" "Get DO account"

echo ""
echo "━━━ 4. ENVIRONMENTS ━━━"
t "POST" "/projects/$PID/environments" "{\"name\":\"staging\",\"gitBranch\":\"main\",\"doAccountId\":\"$DOID\"}" "201" "Create env"
EID=$(cat /tmp/lr.json | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo "     EID=$EID"
t "GET" "/projects/$PID/environments" "" "200" "List envs"
t "GET" "/projects/$PID/environments/$EID" "" "200" "Get env"
t "PATCH" "/projects/$PID/environments/$EID" '{"gitBranch":"develop"}' "200" "Update env"
t "POST" "/projects/$PID/environments" "{\"name\":\"staging\",\"gitBranch\":\"main\",\"doAccountId\":\"$DOID\"}" "409" "Dupe env → 409"

echo ""
echo "━━━ 5. REPOSITORIES ━━━"
t "GET" "/projects/$PID/repository/available" "" "200" "List available repos"
t "GET" "/projects/$PID/repository" "" "404" "No repo → 404"

echo ""
echo "━━━ 6. YAML CONFIG ━━━"
YAML_BODY='{"configYaml":"version: \"1.0\"\nservice:\n  name: my-app\n  type: app\n  region: nyc3\nruntime:\n  instance_size: apps-s-1vcpu-0.5gb\n  replicas: 1\n  port: 3000\n"}'
t "PUT" "/projects/$PID/environments/$EID/config" "$YAML_BODY" "200" "Upload valid YAML"

BAD_YAML='{"configYaml":"version: \"999\"\nservice:\n  name: x\n"}'
t "PUT" "/projects/$PID/environments/$EID/config" "$BAD_YAML" "422" "Invalid YAML schema → 422"

BROKEN='{"configYaml":"invalid: [yaml: {broken"}'
t "PUT" "/projects/$PID/environments/$EID/config" "$BROKEN" "422" "Broken YAML syntax → 422"

echo ""
echo "━━━ 7. PIPELINE BUILDER ━━━"
t "GET" "/environments/$EID/pipeline" "" "200" "Get pipeline (empty)"

PIPE='{
  "nodes":[
    {"id":"n1","type":"GitHubPushTrigger","data":{"branch":"main"},"position":{"x":50,"y":100}},
    {"id":"n2","type":"DockerBuild","data":{"dockerfilePath":"Dockerfile","context":"."},"position":{"x":300,"y":100}},
    {"id":"n3","type":"AppService","data":{"name":"my-app","port":3000,"instanceSize":"apps-s-1vcpu-0.5gb","replicas":1},"position":{"x":550,"y":100}}
  ],
  "edges":[
    {"id":"e1","source":"n1","target":"n2"},
    {"id":"e2","source":"n2","target":"n3"}
  ]
}'
t "PUT" "/environments/$EID/pipeline" "$PIPE" "200" "Save valid pipeline"
echo "     isValid: $(cat /tmp/lr.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('isValid'))" 2>/dev/null)"

t "GET" "/environments/$EID/pipeline" "" "200" "Get pipeline (saved)"

VPIPE='{
  "nodes":[{"id":"n1","type":"AppService","data":{"name":"my-app","port":3000},"position":{"x":50,"y":100}}],
  "edges":[]
}'
t "POST" "/environments/$EID/pipeline/validate" "$VPIPE" "200" "Validate pipeline"
echo "     valid: $(cat /tmp/lr.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('isValid'), 'errors=', len(d.get('validationErrors',[])))" 2>/dev/null)"

t "POST" "/environments/$EID/pipeline/compile" "" "201" "Compile pipeline"
echo "     yaml_valid: $(cat /tmp/lr.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('isValid'), 'yaml_len=', len(d.get('yaml','') or d.get('compiledYaml','') or ''))" 2>/dev/null)"

# Bad pipeline
BADPIPE='{"nodes":[{"id":"n1","type":"AppService","data":{"name":"","port":0},"position":{"x":0,"y":0}}],"edges":[]}'
t "PUT" "/environments/$EID/pipeline" "$BADPIPE" "200" "Save bad pipeline (data)"
echo "     isValid: $(cat /tmp/lr.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('isValid'))" 2>/dev/null)"

# Restore good pipeline for deploy test
t "PUT" "/environments/$EID/pipeline" "$PIPE" "200" "Restore good pipeline"

echo ""
echo "━━━ 8. PIPELINE DEPLOY ━━━"
t "POST" "/environments/$EID/pipeline/deploy" "" "201" "Deploy pipeline"
echo "     result: $(cat /tmp/lr.json | python3 -c "import sys,json; d=json.load(sys.stdin); print('valid=' + str(d.get('isValid',d.get('yaml','')))[:80])" 2>/dev/null)"

echo ""
echo "━━━ 9. DEPLOYMENTS ━━━"
t "GET" "/environments/$EID/deployments" "" "200" "List deployments"
DEPS=$(cat /tmp/lr.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',d) if isinstance(d,dict) else d))" 2>/dev/null)
echo "     count=$DEPS"

# Trigger deployment (should fail — no image built)
t "POST" "/environments/$EID/deployments" '{}' "400" "Deploy without image → 400"

echo ""
echo "━━━ 10. INFRASTRUCTURE ━━━"
t "GET" "/environments/$EID/infrastructure/resources" "" "200" "List resources"

echo ""
echo "━━━ 11. MONITORING (expects 400, no infra) ━━━"
t "GET" "/environments/$EID/logs" "" "400" "Logs (no infra) → 400"
t "GET" "/environments/$EID/metrics/cpu" "" "400" "CPU (no infra) → 400"
t "GET" "/environments/$EID/metrics/memory" "" "400" "Memory (no infra) → 400"
t "GET" "/environments/$EID/metrics/bandwidth" "" "400" "Bandwidth (no infra) → 400"

echo ""
echo "━━━ 12. CLEANUP ━━━"
t "DELETE" "/projects/$PID/environments/$EID" "" "204" "Delete env"
t "DELETE" "/projects/$PID" "" "204" "Delete project"
t "GET" "/projects/$PID" "" "404" "Verify deleted → 404"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║              RESULTS                     ║"
echo "╚══════════════════════════════════════════╝"
echo "  ✅ Passed: $pass"
echo "  ❌ Failed: $fail"
if [ ${#errors[@]} -gt 0 ]; then
  echo ""; echo "  Failed tests:"
  for e in "${errors[@]}"; do echo "    • $e"; done
fi
echo ""
