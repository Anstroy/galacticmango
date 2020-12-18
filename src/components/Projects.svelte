<script>
  import { scale, slide } from "svelte/transition";
  import projects from "../data/projects";

  console.log("hey");

  let singleProject = projects[0];

  let filteredProjects = projects;
  let current = 0;

  function setFilter(cat) {
    cat == "all"
      ? (filteredProjects = projects)
      : (filteredProjects = projects.filter(p => p.category == cat));

    filteredProjects.sort(function(a, b) {
      return a - b;
    });
  }
</script>

<style>
  .latest {
    font-size: 20px;
    position: absolute;
    left: 0;
    background-color: #f5820b;
    color: white;
  }
  .project-filter {
    margin: 10px 0;
    text-align: center;
  }
  .projects {
    text-align: center;
    padding: 10px 50px;
  }

  .card-div {
    padding-top: 10px;
    margin: 20px 0;
    background-color: #f8f9fc;
  }

  .card-div:hover {
    background-color: #eaeaea;
    margin-top: 15px;
  }

  a.item-portfolio-static {
    text-decoration: none;
    color: black;
  }

  .modal-img {
    max-width: 20em;
  }

  @media only screen and (max-width: 991px) {
    .modal-img {
      max-width: 15em;
    }
  }
</style>

<div class="project-filter">
  <h2>Projects</h2>
  <div class="btn-group" role="group" aria-label="Filter projects">
    <button
      class:active={current === 0}
      on:click={() => {
        setFilter('all');
        current = 0;
      }}
      type="button"
      class="btn btn-lg btn-info">
      All
    </button>
    <button
      class:active={current === 1}
      on:click={() => {
        setFilter('web');
        current = 1;
      }}
      type="button"
      class="btn btn-lg btn-info">
      Web
    </button>
    <button
      class:active={current === 2}
      on:click={() => {
        setFilter('mobile');
        current = 2;
      }}
      type="button"
      class="btn btn-lg btn-info">
      Mobile
    </button>
    <button
      class:active={current === 3}
      on:click={() => {
        setFilter('other');
        current = 3;
      }}
      type="button"
      class="btn btn-lg btn-info">
      Other
    </button>
  </div>
  <br />
  <div class="btn-group resume" role="group" aria-label="Third group">
    <a
      href="https://docs.google.com/document/d/1Axfpm_HCpW5CkPHxwwBUZcnAoZtRbl9q8l2D-YiSqcE/edit?usp=sharing"
      target="_blank"
      class="btn btn-sm btn-outline-primary">
      <i class="fas fa-download" />
      Get Resume
    </a>
  </div>
</div>
<div class="row projects">
  {#each filteredProjects as project, i}
    <div
      class="col-xs-6 col-sm-6 col-md-4 col-lg-3 card-div text-center"
      transition:scale>
      {#if project.latest}
        <span class="badge badge-pill latest" in:slide>Latest</span>
      {/if}
      <a
        href="#"
        on:click={() => {
          singleProject = project;
        }}
        data-toggle="modal"
        data-target="#singleProjectModal"
        class="item-portfolio-static gallery masonry_item portfolio-33-33 cat--1">
        <div class="portfolio-static">
          <div class="thumbnail-inner">
            <div class="thumbnail">
              <img
                class="img-fluid"
                src="/projects/{project.id}.jpg"
                alt={project.id}
                width="auto"
                height="200" />
            </div>
          </div>
          <div class="content">
            <p />
            <div class="inner">
              <h4>{project.title}</h4>
              <p>
                {#each project.tags as tag, i}
                  <img
                    src="/icons/{tag}.png"
                    alt=""
                    class="image"
                    width="30px" />
                  &nbsp;&nbsp;
                {/each}
              </p>
            </div>
          </div>
        </div>
      </a>
    </div>
  {/each}
</div>

<!-- Modal -->
<div
  class="modal fade"
  id="singleProjectModal"
  tabindex="-1"
  role="dialog"
  aria-labelledby="singleProjectModalLabel"
  aria-hidden="true">
  <div class="modal-dialog modal-xl" role="document">
    <div class="modal-content">
      <button
        type="button"
        class="close"
        data-dismiss="modal"
        aria-label="Close">
        <span aria-hidden="true">
          <i class="fas fa-times fa-2x" />
        </span>
      </button>
      <div class="modal-body text-center">
        <div class="container">
          <div class="row justify-content-center">
            <div class="col-lg-8">
              <!-- Portfolio Modal - Title -->
              <h2
                class="portfolio-modal-title text-secondary text-uppercase mb-0">
                {singleProject.title}
              </h2>
              <!-- Icon Divider -->
              <div class="divider-custom">
                <div class="divider-custom-line" />
                <div class="divider-custom-line" />
              </div>
              <!-- Portfolio Modal - Image -->
              <img
                class="img-fluid rounded mb-5 modal-img"
                src="/projects/{singleProject.id}.jpg"
                alt="" />
              <!-- Technologies -->
              <h6>Technologies used:</h6>
              <h5>
                {#each singleProject.tags as tag, i}
                  <span class="badge badge-pill badge-default">
                    <img
                      src="/icons/{tag}.png"
                      alt=""
                      class="image"
                      width="30px" />
                  </span>
                  &nbsp;
                {/each}
              </h5>
              <p />
              <!-- Portfolio Modal - Text -->
              <p class="mb-5">{singleProject.desc}</p>
              {#if singleProject.live != ''}
                <a
                  class="btn btn-primary text-white"
                  href={singleProject.live}
                  target="_blank">
                  <i class="fas fa-eye" />
                  Live Demo
                </a>
              {/if}

              {#if singleProject.source != ''}
                <a
                  class="btn btn-info text-white"
                  href={singleProject.source}
                  target="_blank">
                  <i class="fab fa-github" />
                  Source Code
                </a>
              {/if}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
