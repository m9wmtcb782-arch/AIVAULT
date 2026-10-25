/* TronClass → classify queue stub (browser/Node). Failures never block storage. */
(function (root) {
  "use strict";
  var items = [];
  var seen = {};

  function key(fileId, sha) { return String(fileId) + ":" + String(sha); }

  function enqueueClassify(materialMeta, stored) {
    materialMeta = materialMeta || {};
    stored = stored || {};
    var fileId = materialMeta.fileId || stored.fileId || "";
    var sha = stored.sha256 || "";
    var item = {
      fileId: fileId,
      sha256: sha,
      privatePath: stored.privatePath || "",
      fileName: materialMeta.fileName || stored.fileName || "",
      courseCode: materialMeta.courseCode || stored.courseCode || "",
      academicYear: materialMeta.academicYear || stored.academicYear || "",
      semester: materialMeta.semester || stored.semester || "",
      courseId: materialMeta.courseId || stored.courseId || "",
      school: "SCU",
      status: "queued",
      error: null
    };
    var k = key(fileId, sha);
    if (seen[k] === "done" || seen[k] === "queued" || seen[k] === "deduped") {
      item.status = "deduped";
      items.push(item);
      return item;
    }
    seen[k] = "queued";
    items.push(item);
    return item;
  }

  function processStub(item) {
    try {
      var title = item.fileName || "";
      var fmt = root.AivaultFormatDetect
        ? root.AivaultFormatDetect.detectFromBytes(new Uint8Array(0), title)
        : { bucket: "other" };
      var subj = root.AivaultSubjectClassify
        ? root.AivaultSubjectClassify.classifySubject({ title: title })
        : { pending: true, primary: null };
      item.status = "done";
      seen[key(item.fileId, item.sha256)] = "done";
      item.result = { format_bucket: fmt.bucket, subject: subj, source_meta: {
        school: item.school, course_code: item.courseCode, academic_year: item.academicYear,
        semester: item.semester, course_id: item.courseId, file_name: item.fileName
      }};
      return item;
    } catch (e) {
      item.status = "failed";
      item.error = String(e && e.message || e);
      seen[key(item.fileId, item.sha256)] = "failed";
      return item;
    }
  }

  root.AivaultClassifyQueue = {
    enqueueClassify: enqueueClassify,
    processStub: processStub,
    items: function () { return items.slice(); },
    reset: function () { items = []; seen = {}; }
  };
})(typeof window !== "undefined" ? window : globalThis);
