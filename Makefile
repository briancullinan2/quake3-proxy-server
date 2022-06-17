
MOUNT_DIR := ../Quake3e/code
BUILD_DIR := ../Quake3e/build
ARCH := x86_64
PLATFORM := darwin
CC := gcc
USE_RENDERER_DLOPEN=0

ifeq ($(V),1)
echo_cmd=@:
Q=
else
echo_cmd=@echo
Q=@
endif

B := $(BUILD_DIR)/release-$(PLATFORM)-$(ARCH)
RENDERER_PREFIX := quake3e
TARGET_CLIENT := $(RENDERER_PREFIX)_opengl_$(ARCH)
R2DIR=$(MOUNT_DIR)/renderer2
RCDIR=$(MOUNT_DIR)/renderercommon
WASMDIR=$(MOUNT_DIR)/wasm
CMDIR=$(MOUNT_DIR)/qcommon
CDIR=$(MOUNT_DIR)/client
SDLDIR=$(MOUNT_DIR)/sdl
UDIR=$(MOUNT_DIR)/unix

Q3OBJ += \
	$(B)/rend2-cli/cl_main.o \
	$(B)/rend2-cli/cl_jpeg.o \
	$(B)/rend2-cli/sdl_glimp.o \
	\
	$(B)/rend2-cli/render.o \
	$(B)/rend2-cli/files.o \
	$(B)/rend2-cli/cmd.o \
	$(B)/rend2-cli/cvar.o \
	$(B)/rend2-cli/common.o \
	$(B)/rend2-cli/unzip.o \
	$(B)/rend2-cli/md4.o \
	\
	$(B)/rend2-cli/cm_load.o \
	$(B)/rend2-cli/cm_patch.o \
	$(B)/rend2-cli/cm_polylib.o \
	$(B)/rend2-cli/cm_test.o \
	$(B)/rend2-cli/cm_trace.o 

Q3OBJ += \
	$(B)/rend2-cli/unix_shared.o \
  $(B)/rend2-cli/unix_main.o \
	$(B)/rend2-cli/linux_signals.o

Q3REND2OBJ = \
  $(B)/rend2-cli/tr_animation.o \
  $(B)/rend2-cli/tr_backend.o \
  $(B)/rend2-cli/tr_bsp.o \
  $(B)/rend2-cli/tr_cmds.o \
  $(B)/rend2-cli/tr_curve.o \
  $(B)/rend2-cli/tr_dsa.o \
  $(B)/rend2-cli/tr_extramath.o \
  $(B)/rend2-cli/tr_extensions.o \
  $(B)/rend2-cli/tr_fbo.o \
  $(B)/rend2-cli/tr_flares.o \
  $(B)/rend2-cli/tr_font.o \
  $(B)/rend2-cli/tr_glsl.o \
  $(B)/rend2-cli/tr_image.o \
  $(B)/rend2-cli/tr_image_bmp.o \
  $(B)/rend2-cli/tr_image_jpg.o \
  $(B)/rend2-cli/tr_image_pcx.o \
  $(B)/rend2-cli/tr_image_png.o \
  $(B)/rend2-cli/tr_image_tga.o \
  $(B)/rend2-cli/tr_image_dds.o \
  $(B)/rend2-cli/tr_init.o \
  $(B)/rend2-cli/tr_light.o \
  $(B)/rend2-cli/tr_main.o \
  $(B)/rend2-cli/tr_marks.o \
  $(B)/rend2-cli/tr_mesh.o \
  $(B)/rend2-cli/tr_model.o \
  $(B)/rend2-cli/tr_model_iqm.o \
  $(B)/rend2-cli/tr_noise.o \
  $(B)/rend2-cli/tr_postprocess.o \
  $(B)/rend2-cli/tr_scene.o \
  $(B)/rend2-cli/tr_shade.o \
  $(B)/rend2-cli/tr_shade_calc.o \
  $(B)/rend2-cli/tr_shader.o \
  $(B)/rend2-cli/tr_shadows.o \
  $(B)/rend2-cli/tr_sky.o \
  $(B)/rend2-cli/tr_surface.o \
  $(B)/rend2-cli/tr_vbo.o \
  $(B)/rend2-cli/tr_world.o

#ifneq ($(USE_RENDERER_DLOPEN), 0)
Q3REND2OBJ += \
  $(B)/rend2-cli/q_shared.o \
  $(B)/rend2-cli/puff.o \
  $(B)/rend2-cli/q_math.o
#endif

Q3REND2STROBJ = \
  $(B)/rend2-cli/glsl/bokeh_fp.o \
  $(B)/rend2-cli/glsl/bokeh_vp.o \
  $(B)/rend2-cli/glsl/calclevels4x_fp.o \
  $(B)/rend2-cli/glsl/calclevels4x_vp.o \
  $(B)/rend2-cli/glsl/depthblur_fp.o \
  $(B)/rend2-cli/glsl/depthblur_vp.o \
  $(B)/rend2-cli/glsl/dlight_fp.o \
  $(B)/rend2-cli/glsl/dlight_vp.o \
  $(B)/rend2-cli/glsl/down4x_fp.o \
  $(B)/rend2-cli/glsl/down4x_vp.o \
  $(B)/rend2-cli/glsl/fogpass_fp.o \
  $(B)/rend2-cli/glsl/fogpass_vp.o \
  $(B)/rend2-cli/glsl/generic_fp.o \
  $(B)/rend2-cli/glsl/generic_vp.o \
  $(B)/rend2-cli/glsl/lightall_fp.o \
  $(B)/rend2-cli/glsl/lightall_vp.o \
  $(B)/rend2-cli/glsl/pshadow_fp.o \
  $(B)/rend2-cli/glsl/pshadow_vp.o \
  $(B)/rend2-cli/glsl/shadowfill_fp.o \
  $(B)/rend2-cli/glsl/shadowfill_vp.o \
  $(B)/rend2-cli/glsl/shadowmask_fp.o \
  $(B)/rend2-cli/glsl/shadowmask_vp.o \
  $(B)/rend2-cli/glsl/ssao_fp.o \
  $(B)/rend2-cli/glsl/ssao_vp.o \
  $(B)/rend2-cli/glsl/texturecolor_fp.o \
  $(B)/rend2-cli/glsl/texturecolor_vp.o \
  $(B)/rend2-cli/glsl/tonemap_fp.o \
  $(B)/rend2-cli/glsl/tonemap_vp.o

Q3OBJ += $(Q3REND2OBJ) $(Q3REND2STROBJ)

RENDCFLAGS := \
	-DBUILD_CLI_RENDERER=1 \
	-DUSE_SYSTEM_JPEG \
	-DRENDERER_PREFIX=\"quake3e\" \
  -I/Library/Frameworks/SDL2.framework/Headers
LDFLAGS := -F/Library/Frameworks -framework SDL2 \
	 -ljpeg


define DO_REND_CC
$(echo_cmd) "REND_CC $<"
$(Q)$(CC) $(RENDCFLAGS) $(CFLAGS) -o $@ -c $<
endef

$(B)/rend2-cli/glsl/%.c: $(R2DIR)/glsl/%.glsl
	$(echo_cmd) "REF_STR $@"
	$(Q)echo "const char *fallbackShader_$(notdir $(basename $<)) =" >> $@
	$(Q)cat $< | sed -e 's/^/\"/;s/$$/\\n\"/' | tr -d '\r' >> $@
	$(Q)echo ";" >> $@

$(B)/rend2-cli/glsl/%.o: $(B)/renderer2/glsl/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(R2DIR)/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(CDIR)/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(RCDIR)/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(SDLDIR)/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(UDIR)/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(WASMDIR)/%.c
	$(DO_REND_CC)

$(B)/rend2-cli/%.o: $(CMDIR)/%.c
	$(DO_REND_CC)

$(B)/$(TARGET_CLIENT): renderer $(Q3OBJ)
	$(echo_cmd) "LD $@"
	$(Q)$(CC) -o $@ $(Q3OBJ) $(CLIENT_LDFLAGS) \
		$(LDFLAGS)

renderer:
  -@mkdir -p BUILD_DIR/rend2/glsl

default: $(TARGET_CLIENT)
