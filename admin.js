const cfg = window.AXOMPREP_CONFIG;

const client = supabase.createClient(
  cfg.supabaseUrl,
  cfg.supabasePublishableKey
);

const $ = id => document.getElementById(id);


/* =========================
   HELPERS
========================= */

function msg(id, text, hide = false) {
  const e = $(id);

  if (!e) return;

  e.textContent = text;
  e.classList.toggle('hidden', hide);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}


/* =========================
   INITIALIZATION
========================= */

async function init() {

  const {
    data: { user },
    error: userError
  } = await client.auth.getUser();

  if (userError || !user) {

    if ($('authMessage')) {
      $('authMessage').textContent =
        'Please log in with your AxomPrep account.';
    }

    return;
  }


  /* Check admin profile */

  const {
    data: profile,
    error: profileError
  } = await client
    .from('profiles')
    .select('role,full_name')
    .eq('id', user.id)
    .maybeSingle();


  if (profileError) {

    alert(
      'Unable to check admin access:\n\n' +
      profileError.message
    );

    return;
  }


  if (!profile || profile.role !== 'admin') {

    if ($('authMessage')) {
      $('authMessage').textContent =
        'Your account does not have admin access yet.';
    }

    return;
  }


  /* Show admin application */

  if ($('authState')) {
    $('authState').classList.add('hidden');
  }

  if ($('adminApp')) {
    $('adminApp').classList.remove('hidden');
  }

  if ($('adminUser')) {
    $('adminUser').textContent =
      profile.full_name || user.email;
  }


  try {

    await loadOptions();
    await loadQuestions();
    await loadStats();
    await loadCurrent();

  } catch (error) {

    console.error('ADMIN INITIALIZATION ERROR:', error);

    alert(
      'Admin panel error:\n\n' +
      error.message
    );
  }
}


/* =========================
   LOGIN
========================= */

if ($('loginAdmin')) {

  $('loginAdmin').onclick = () => {

    sessionStorage.setItem(
      'axomprep_admin_return',
      '/admin'
    );

    location.href = '/#login';
  };
}


/* =========================
   LOGOUT
========================= */

if ($('logoutBtn')) {

  $('logoutBtn').onclick = async () => {

    await client.auth.signOut();

    location.href = 'index.html';
  };
}


/* =========================
   LOAD EXAMS + SUBJECTS
========================= */

async function loadOptions() {

  const [
    examsResult,
    subjectsResult
  ] = await Promise.all([

    client
      .from('exams')
      .select('id,name')
      .order('name'),

    client
      .from('subjects')
      .select('id,name')
      .order('name')
  ]);


  if (examsResult.error) {
    throw examsResult.error;
  }

  if (subjectsResult.error) {
    throw subjectsResult.error;
  }


  if ($('exam')) {

    $('exam').innerHTML =
      '<option value="">Select exam</option>' +

      (examsResult.data || [])
        .map(exam =>
          `<option value="${exam.id}">
            ${esc(exam.name)}
          </option>`
        )
        .join('');
  }


  if ($('subject')) {

    $('subject').innerHTML =
      '<option value="">Select subject</option>' +

      (subjectsResult.data || [])
        .map(subject =>
          `<option value="${subject.id}">
            ${esc(subject.name)}
          </option>`
        )
        .join('');
  }
}


/* =========================
   LOAD STATISTICS
========================= */

async function loadStats() {

  const [
    published,
    review,
    currentAffairs
  ] = await Promise.all([

    client
      .from('questions')
      .select('*', {
        count: 'exact',
        head: true
      })
      .eq('status', 'published'),

    client
      .from('questions')
      .select('*', {
        count: 'exact',
        head: true
      })
      .in('status', ['draft', 'review']),

    client
      .from('current_affairs')
      .select('*', {
        count: 'exact',
        head: true
      })
  ]);


  if (published.error) {
    throw published.error;
  }

  if (review.error) {
    throw review.error;
  }

  if (currentAffairs.error) {
    throw currentAffairs.error;
  }


  if ($('qCount')) {
    $('qCount').textContent =
      published.count ?? 0;
  }

  if ($('reviewCount')) {
    $('reviewCount').textContent =
      review.count ?? 0;
  }

  if ($('caCount')) {
    $('caCount').textContent =
      currentAffairs.count ?? 0;
  }
}


/* =========================
   LOAD QUESTIONS
========================= */

async function loadQuestions() {

  const {
    data,
    error
  } = await client
    .from('questions')
    .select(`
      id,
      question,
      status,
      exam_id,
      subject_id,
      created_at,
      exams(name),
      subjects(name)
    `)
    .order('created_at', {
      ascending: false
    })
    .limit(100);


  if (error) {
    throw error;
  }


  if (!$('questionRows')) {
    return;
  }


  $('questionRows').innerHTML =
    (data || [])
      .map(q => `

        <tr>

          <td>
            ${esc(q.question).slice(0, 180)}
          </td>

          <td>
            ${esc(q.subjects?.name || '')}
          </td>

          <td>
            ${esc(q.exams?.name || '')}
          </td>

          <td>
            <span class="badge">
              ${esc(q.status)}
            </span>
          </td>

          <td>

            ${
              q.status !== 'published'

                ? `
                  <button
                    class="btn light"
                    onclick="setStatus('${q.id}','published')">
                    Publish
                  </button>
                `

                : `
                  <button
                    class="btn light"
                    onclick="setStatus('${q.id}','draft')">
                    Unpublish
                  </button>
                `
            }

          </td>

        </tr>

      `)
      .join('') ||

    `
      <tr>
        <td colspan="5">
          No questions yet.
        </td>
      </tr>
    `;
}


/* =========================
   CHANGE QUESTION STATUS
========================= */

window.setStatus = async function(id, status) {

  const {
    error
  } = await client
    .from('questions')
    .update({
      status: status
    })
    .eq('id', id);


  if (error) {

    alert(
      'Unable to update question:\n\n' +
      error.message
    );

    return;
  }


  await loadQuestions();
  await loadStats();
};


/* =========================
   ADD QUESTION
========================= */

if ($('questionForm')) {

  $('questionForm').onsubmit = async function(e) {

    e.preventDefault();


    const button =
      $('questionForm')
        .querySelector('button[type="submit"]');


    const oldText =
      button ? button.textContent : 'Save Question';


    if (button) {

      button.disabled = true;
      button.textContent = 'Saving...';
    }


    msg(
      'formMsg',
      'Saving question...',
      false
    );


    try {

      /* Get logged-in user */

      const {
        data: { user },
        error: userError
      } = await client.auth.getUser();


      if (userError) {
        throw userError;
      }


      if (!user) {

        throw new Error(
          'Your login session has expired. Please log in again.'
        );
      }


      /* Convert tags text into PostgreSQL array */

      const tags = $('tags').value
        .split(',')
        .map(x => x.trim())
        .filter(Boolean);


      /* Convert UI difficulty values */

      const difficultyMap = {

        'Easy': 'easy',

        'Moderate': 'medium',

        'Hard': 'hard'

      };


      const difficulty =
        difficultyMap[$('difficulty').value] ||
        'medium';


      /* Build database row */

      const row = {

        question:
          $('qtext').value.trim(),

        option_a:
          $('a').value.trim(),

        option_b:
          $('b').value.trim(),

        option_c:
          $('c').value.trim(),

        option_d:
          $('d').value.trim(),

        answer:
          $('answer').value,

        explanation:
          $('explanation').value.trim() || null,

        exam_id:
          $('exam').value || null,

        subject_id:
          $('subject').value || null,

        topic_id:
          null,

        difficulty:
          difficulty,

        year:
          $('year').value
            ? Number($('year').value)
            : null,

        tags:
          tags,

        status:
          $('status').value || 'draft',

        created_by:
          user.id
      };


      console.log(
        'QUESTION BEING SUBMITTED:',
        row
      );


      /* Insert question */

      const {
        data,
        error
      } = await client
        .from('questions')
        .insert(row)
        .select()
        .single();


      /* IMPORTANT:
         Show exact Supabase error */

      if (error) {

        console.error(
          'SUPABASE INSERT ERROR:',
          error
        );

        throw new Error(

          error.message +

          (
            error.details
              ? '\nDetails: ' +
                error.details
              : ''
          ) +

          (
            error.hint
              ? '\nHint: ' +
                error.hint
              : ''
          )
        );
      }


      console.log(
        'QUESTION SAVED:',
        data
      );


      msg(
        'formMsg',
        'Question saved successfully.',
        false
      );


      alert(
        'Question saved successfully.'
      );


      /* Reset form */

      $('questionForm').reset();


      /* Refresh admin data */

      await loadQuestions();
      await loadStats();


    } catch (error) {

      console.error(
        'SAVE QUESTION ERROR:',
        error
      );


      const errorText =
        error?.message ||
        String(error);


      msg(
        'formMsg',
        'Could not save question: ' +
          errorText,
        false
      );


      alert(
        'QUESTION COULD NOT BE SAVED\n\n' +
        errorText
      );


    } finally {

      if (button) {

        button.disabled = false;
        button.textContent = oldText;
      }
    }
  };
}


/* =========================
   CSV PARSER
========================= */

function parseCSV(text) {

  const rows = [];

  let row = [];

  let cell = '';

  let quote = false;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const ch = text[i];

    const next = text[i + 1];


    /* Escaped quote */

    if (
      ch === '"' &&
      quote &&
      next === '"'
    ) {

      cell += '"';

      i++;

      continue;
    }


    /* Start/end quote */

    if (ch === '"') {

      quote = !quote;

      continue;
    }


    /* Column separator */

    if (
      ch === ',' &&
      !quote
    ) {

      row.push(cell);

      cell = '';

      continue;
    }


    /* New row */

    if (
      (ch === '\n' ||
       ch === '\r') &&
      !quote
    ) {

      if (
        ch === '\r' &&
        next === '\n'
      ) {

        i++;
      }


      row.push(cell);

      cell = '';


      if (
        row.some(
          value =>
            value.trim()
        )
      ) {

        rows.push(row);
      }


      row = [];

      continue;
    }


    cell += ch;
  }


  /* Last cell */

  if (
    cell ||
    row.length
  ) {

    row.push(cell);

    rows.push(row);
  }


  return rows;
}


/* =========================
   CSV IMPORT
========================= */

if ($('importCsv')) {

  $('importCsv').onclick = async function() {

    const file =
      $('csvFile')?.files?.[0];


    if (!file) {

      msg(
        'csvMsg',
        'Choose a CSV file first.',
        false
      );

      return;
    }


    try {

      const text =
        await file.text();


      const rows =
        parseCSV(text);


      if (rows.length < 2) {

        msg(
          'csvMsg',
          'CSV has no data rows.',
          false
        );

        return;
      }


      const headers =
        rows[0]
          .map(x =>
            x.trim().toLowerCase()
          );


      const objects =
        rows.slice(1)
          .map(row =>
            Object.fromEntries(
              headers.map(
                (header, index) => [

                  header,

                  (
                    row[index] ||
                    ''
                  ).trim()

                ]
              )
            )
          );


      /* Load exams and subjects */

      const [
        examsResult,
        subjectsResult
      ] = await Promise.all([

        client
          .from('exams')
          .select('id,name'),

        client
          .from('subjects')
          .select('id,name')
      ]);


      if (examsResult.error) {
        throw examsResult.error;
      }

      if (subjectsResult.error) {
        throw subjectsResult.error;
      }


      const exams =
        Object.fromEntries(

          (examsResult.data || [])
            .map(exam => [

              exam.name.toLowerCase(),

              exam.id

            ])
        );


      const subjects =
        Object.fromEntries(

          (subjectsResult.data || [])
            .map(subject => [

              subject.name.toLowerCase(),

              subject.id

            ])
        );


      /* Build import rows */

      const payload =
        objects
          .filter(row => row.question)
          .map(row => ({

            question:
              row.question,

            option_a:
              row.option_a,

            option_b:
              row.option_b,

            option_c:
              row.option_c,

            option_d:
              row.option_d,

            answer:
              (
                row.answer ||
                'A'
              ).toUpperCase(),

            explanation:
              row.explanation ||
              null,

            exam_id:
              exams[
                (
                  row.exam ||
                  ''
                ).toLowerCase()
              ] || null,

            subject_id:
              subjects[
                (
                  row.subject ||
                  ''
                ).toLowerCase()
              ] || null,

            topic_id:
              null,

            difficulty:
              (
                row.difficulty ||
                'medium'
              ).toLowerCase(),

            year:
              row.year
                ? Number(row.year)
                : null,

            tags:
              (
                row.tags ||
                ''
              )
              .split(',')
              .map(v => v.trim())
              .filter(Boolean),

            status:
              row.status ||
              'draft'
          }));


      if (!payload.length) {

        throw new Error(
          'No valid questions were found in the CSV.'
        );
      }


      /* Insert */

      const {
        error
      } = await client
        .from('questions')
        .insert(payload);


      if (error) {

        throw new Error(
          error.message +
          (
            error.details
              ? '\nDetails: ' +
                error.details
              : ''
          )
        );
      }


      msg(
        'csvMsg',
        `Imported ${payload.length} questions successfully.`,
        false
      );


      await loadQuestions();
      await loadStats();


    } catch (error) {

      console.error(
        'CSV IMPORT ERROR:',
        error
      );


      msg(
        'csvMsg',
        'CSV import failed: ' +
          error.message,
        false
      );


      alert(
        'CSV IMPORT FAILED\n\n' +
        error.message
      );
    }
  };
}


/* =========================
   CURRENT AFFAIRS
========================= */

if ($('caForm')) {

  $('caForm').onsubmit = async function(e) {

    e.preventDefault();


    try {

      const row = {

        title:
          $('caTitle').value.trim(),

        content:
          $('caContent').value.trim(),

        category:
          $('caCategory').value,

        published_date:
          $('caDate').value,

        is_published:
          $('caPublish').value === 'true'
      };


      const {
        error
      } = await client
        .from('current_affairs')
        .insert(row);


      if (error) {

        throw error;
      }


      msg(
        'caMsg',
        'Current affair saved successfully.',
        false
      );


      $('caForm').reset();


      await loadCurrent();
      await loadStats();


    } catch (error) {

      console.error(
        'CURRENT AFFAIRS ERROR:',
        error
      );


      msg(
        'caMsg',
        error.message,
        false
      );


      alert(
        'CURRENT AFFAIRS ERROR\n\n' +
        error.message
      );
    }
  };
}


/* =========================
   LOAD CURRENT AFFAIRS
========================= */

async function loadCurrent() {

  const {
    data,
    error
  } = await client
    .from('current_affairs')
    .select(`
      title,
      category,
      published_date,
      is_published
    `)
    .order('published_date', {
      ascending: false
    })
    .limit(30);


  if (error) {

    throw error;
  }


  if (!$('caRows')) {
    return;
  }


  $('caRows').innerHTML =
    (data || [])
      .map(item => `

        <tr>

          <td>
            ${esc(item.title)}
          </td>

          <td>
            ${esc(item.category || '')}
          </td>

          <td>
            ${item.published_date || ''}
          </td>

          <td>
            ${
              item.is_published
                ? 'Yes'
                : 'No'
            }
          </td>

        </tr>

      `)
      .join('') ||

    `
      <tr>
        <td colspan="4">
          No current affairs yet.
        </td>
      </tr>
    `;
}


/* =========================
   ADMIN TAB NAVIGATION
========================= */

document
  .querySelectorAll('.admin-nav button')
  .forEach(button => {

    button.onclick = () => {

      document
        .querySelectorAll('.admin-nav button')
        .forEach(item =>
          item.classList.remove('active')
        );


      button.classList.add('active');


      document
        .querySelectorAll('.tab')
        .forEach(tab =>
          tab.classList.add('hidden')
        );


      const target =
        $('tab-' + button.dataset.tab);


      if (target) {

        target.classList.remove('hidden');
      }
    };
  });


/* =========================
   START ADMIN
========================= */

init();
